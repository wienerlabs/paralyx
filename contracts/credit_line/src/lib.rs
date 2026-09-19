#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, Address, BytesN, Env, Map, String, Vec,
};

pub const REQUEST_SUPPLY_COLLATERAL: u32 = 2;
pub const REQUEST_WITHDRAW_COLLATERAL: u32 = 3;
pub const REQUEST_BORROW: u32 = 4;
pub const REQUEST_REPAY: u32 = 5;

const DAY_LEDGERS: u32 = 17_280;
const LINE_TTL_THRESHOLD: u32 = DAY_LEDGERS * 14;
const LINE_TTL_EXTEND: u32 = DAY_LEDGERS * 60;
const INSTANCE_TTL_THRESHOLD: u32 = DAY_LEDGERS * 14;
const INSTANCE_TTL_EXTEND: u32 = DAY_LEDGERS * 60;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Request {
    pub request_type: u32,
    pub address: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Positions {
    pub liabilities: Map<u32, i128>,
    pub collateral: Map<u32, i128>,
    pub supply: Map<u32, i128>,
}

#[contractclient(name = "BlendPoolClient")]
pub trait BlendPool {
    fn submit(env: Env, from: Address, spender: Address, to: Address, requests: Vec<Request>) -> Positions;
    fn get_positions(env: Env, address: Address) -> Positions;
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub pool: Address,
    pub collateral_asset: Address,
    pub debt_asset: Address,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Line {
    pub opened_at: u64,
    pub updated_at: u64,
    pub collateral_in: i128,
    pub collateral_out: i128,
    pub borrowed: i128,
    pub repaid: i128,
    pub payouts: u32,
    pub payout_try: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Count,
    Line(Address),
}

#[contractevent(topics = ["paralyx", "opened"])]
pub struct LineOpened {
    #[topic]
    pub user: Address,
    pub collateral_amount: i128,
    pub borrow_amount: i128,
}

#[contractevent(topics = ["paralyx", "repaid"])]
pub struct LineRepaid {
    #[topic]
    pub user: Address,
    pub repay_amount: i128,
    pub withdraw_collateral: i128,
}

#[contractevent(topics = ["paralyx", "payout"])]
pub struct PayoutRecorded {
    #[topic]
    pub user: Address,
    pub anchor_tx_id: String,
    pub try_amount: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NegativeAmount = 1,
    EmptyRequest = 2,
    LineNotFound = 3,
}

#[contract]
pub struct CreditLine;

#[contractimpl]
impl CreditLine {
    pub fn __constructor(env: Env, admin: Address, pool: Address, collateral_asset: Address, debt_asset: Address) {
        let config = Config { admin, pool, collateral_asset, debt_asset };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Count, &0u32);
    }

    pub fn open_line(env: Env, user: Address, collateral_amount: i128, borrow_amount: i128) -> Line {
        user.require_auth();
        Self::bump_instance(&env);
        let config = Self::config(&env);
        let mut requests: Vec<Request> = Vec::new(&env);
        Self::push_request(&env, &mut requests, REQUEST_SUPPLY_COLLATERAL, &config.collateral_asset, collateral_amount);
        Self::push_request(&env, &mut requests, REQUEST_BORROW, &config.debt_asset, borrow_amount);
        if requests.is_empty() {
            panic_with_error!(&env, Error::EmptyRequest);
        }
        BlendPoolClient::new(&env, &config.pool).submit(&user, &user, &user, &requests);

        let now = env.ledger().timestamp();
        let key = DataKey::Line(user.clone());
        let mut line = match Self::read_line(&env, &key) {
            Some(existing) => existing,
            None => {
                let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
                env.storage().instance().set(&DataKey::Count, &(count + 1));
                Line {
                    opened_at: now,
                    updated_at: now,
                    collateral_in: 0,
                    collateral_out: 0,
                    borrowed: 0,
                    repaid: 0,
                    payouts: 0,
                    payout_try: 0,
                }
            }
        };
        line.updated_at = now;
        line.collateral_in += collateral_amount;
        line.borrowed += borrow_amount;
        Self::write_line(&env, &key, &line);
        LineOpened { user, collateral_amount, borrow_amount }.publish(&env);
        line
    }

    pub fn repay_line(env: Env, user: Address, repay_amount: i128, withdraw_collateral: i128) -> Line {
        user.require_auth();
        Self::bump_instance(&env);
        let config = Self::config(&env);
        let key = DataKey::Line(user.clone());
        let mut line = match Self::read_line(&env, &key) {
            Some(existing) => existing,
            None => panic_with_error!(&env, Error::LineNotFound),
        };
        let mut requests: Vec<Request> = Vec::new(&env);
        Self::push_request(&env, &mut requests, REQUEST_REPAY, &config.debt_asset, repay_amount);
        Self::push_request(&env, &mut requests, REQUEST_WITHDRAW_COLLATERAL, &config.collateral_asset, withdraw_collateral);
        if requests.is_empty() {
            panic_with_error!(&env, Error::EmptyRequest);
        }
        BlendPoolClient::new(&env, &config.pool).submit(&user, &user, &user, &requests);

        line.updated_at = env.ledger().timestamp();
        line.repaid += repay_amount;
        line.collateral_out += withdraw_collateral;
        Self::write_line(&env, &key, &line);
        LineRepaid { user, repay_amount, withdraw_collateral }.publish(&env);
        line
    }

    pub fn record_payout(env: Env, user: Address, anchor_tx_id: String, try_amount: i128) -> Line {
        user.require_auth();
        Self::bump_instance(&env);
        if try_amount < 0 {
            panic_with_error!(&env, Error::NegativeAmount);
        }
        let key = DataKey::Line(user.clone());
        let mut line = match Self::read_line(&env, &key) {
            Some(existing) => existing,
            None => panic_with_error!(&env, Error::LineNotFound),
        };
        line.updated_at = env.ledger().timestamp();
        line.payouts += 1;
        line.payout_try += try_amount;
        Self::write_line(&env, &key, &line);
        PayoutRecorded { user, anchor_tx_id, try_amount }.publish(&env);
        line
    }

    pub fn get_line(env: Env, user: Address) -> Option<Line> {
        Self::read_line(&env, &DataKey::Line(user))
    }

    pub fn get_config(env: Env) -> Config {
        Self::config(&env)
    }

    pub fn get_line_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn positions(env: Env, user: Address) -> Positions {
        let config = Self::config(&env);
        BlendPoolClient::new(&env, &config.pool).get_positions(&user)
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let config = Self::config(&env);
        config.admin.require_auth();
        env.deployer().update_current_contract(soroban_sdk::ContractExecutable::Wasm(new_wasm_hash));
    }

    fn config(env: &Env) -> Config {
        env.storage().instance().get(&DataKey::Config).unwrap()
    }

    fn push_request(env: &Env, requests: &mut Vec<Request>, request_type: u32, asset: &Address, amount: i128) {
        if amount < 0 {
            panic_with_error!(env, Error::NegativeAmount);
        }
        if amount > 0 {
            requests.push_back(Request { request_type, address: asset.clone(), amount });
        }
    }

    fn read_line(env: &Env, key: &DataKey) -> Option<Line> {
        let line: Option<Line> = env.storage().persistent().get(key);
        if line.is_some() {
            env.storage().persistent().extend_ttl(key, LINE_TTL_THRESHOLD, LINE_TTL_EXTEND);
        }
        line
    }

    fn write_line(env: &Env, key: &DataKey, line: &Line) {
        env.storage().persistent().set(key, line);
        env.storage().persistent().extend_ttl(key, LINE_TTL_THRESHOLD, LINE_TTL_EXTEND);
    }

    fn bump_instance(env: &Env) {
        env.storage().instance().extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);
    }
}

#[cfg(test)]
mod test;
