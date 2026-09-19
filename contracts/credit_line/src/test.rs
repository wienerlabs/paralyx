use crate::{
    CreditLine, CreditLineClient, Positions, Request, REQUEST_BORROW, REQUEST_REPAY,
    REQUEST_SUPPLY_COLLATERAL, REQUEST_WITHDRAW_COLLATERAL,
};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Map, String, Vec};

#[contract]
pub struct MockPool;

#[contractimpl]
impl MockPool {
    pub fn submit(env: Env, from: Address, spender: Address, to: Address, requests: Vec<Request>) -> Positions {
        env.storage().instance().set(&symbol_short!("last"), &(from, spender, to, requests));
        let calls: u32 = env.storage().instance().get(&symbol_short!("calls")).unwrap_or(0);
        env.storage().instance().set(&symbol_short!("calls"), &(calls + 1));
        Positions { liabilities: Map::new(&env), collateral: Map::new(&env), supply: Map::new(&env) }
    }

    pub fn get_positions(env: Env, _address: Address) -> Positions {
        let mut collateral = Map::new(&env);
        collateral.set(0u32, 5_000_000i128);
        Positions { liabilities: Map::new(&env), collateral, supply: Map::new(&env) }
    }

    pub fn last(env: Env) -> (Address, Address, Address, Vec<Request>) {
        env.storage().instance().get(&symbol_short!("last")).unwrap()
    }

    pub fn calls(env: Env) -> u32 {
        env.storage().instance().get(&symbol_short!("calls")).unwrap_or(0)
    }
}

struct Fixture {
    env: Env,
    client: CreditLineClient<'static>,
    pool: MockPoolClient<'static>,
    admin: Address,
    user: Address,
    collateral: Address,
    debt: Address,
}

fn setup() -> Fixture {
    let env = Env::default();
    env.ledger().set_timestamp(1_700_000_000);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let collateral = Address::generate(&env);
    let debt = Address::generate(&env);
    let pool_id = env.register(MockPool, ());
    let contract_id = env.register(CreditLine, (&admin, &pool_id, &collateral, &debt));
    Fixture {
        client: CreditLineClient::new(&env, &contract_id),
        pool: MockPoolClient::new(&env, &pool_id),
        env,
        admin,
        user,
        collateral,
        debt,
    }
}

#[test]
fn open_line_forwards_collateral_and_borrow_to_pool() {
    let f = setup();
    f.env.mock_all_auths();
    let line = f.client.open_line(&f.user, &1_000_0000000, &100_0000000);
    assert_eq!(line.collateral_in, 1_000_0000000);
    assert_eq!(line.borrowed, 100_0000000);
    assert_eq!(line.opened_at, 1_700_000_000);
    let (from, spender, to, requests) = f.pool.last();
    assert_eq!(from, f.user);
    assert_eq!(spender, f.user);
    assert_eq!(to, f.user);
    assert_eq!(requests.len(), 2);
    assert_eq!(requests.get(0).unwrap().request_type, REQUEST_SUPPLY_COLLATERAL);
    assert_eq!(requests.get(0).unwrap().address, f.collateral);
    assert_eq!(requests.get(1).unwrap().request_type, REQUEST_BORROW);
    assert_eq!(requests.get(1).unwrap().address, f.debt);
    assert_eq!(f.client.get_line_count(), 1);
}

#[test]
fn open_line_requires_user_auth() {
    let f = setup();
    assert!(f.client.try_open_line(&f.user, &10_0000000, &1_0000000).is_err());
    assert_eq!(f.pool.calls(), 0);
    assert_eq!(f.client.get_line(&f.user), None);
}

#[test]
fn open_line_rejects_empty_and_negative_requests() {
    let f = setup();
    f.env.mock_all_auths();
    assert!(f.client.try_open_line(&f.user, &0, &0).is_err());
    assert!(f.client.try_open_line(&f.user, &-1, &0).is_err());
    assert_eq!(f.pool.calls(), 0);
}

#[test]
fn second_open_aggregates_without_double_counting_lines() {
    let f = setup();
    f.env.mock_all_auths();
    f.client.open_line(&f.user, &10_0000000, &0);
    f.env.ledger().set_timestamp(1_700_000_500);
    let line = f.client.open_line(&f.user, &0, &4_0000000);
    assert_eq!(line.collateral_in, 10_0000000);
    assert_eq!(line.borrowed, 4_0000000);
    assert_eq!(line.opened_at, 1_700_000_000);
    assert_eq!(line.updated_at, 1_700_000_500);
    assert_eq!(f.client.get_line_count(), 1);
    let (_, _, _, requests) = f.pool.last();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests.get(0).unwrap().request_type, REQUEST_BORROW);
}

#[test]
fn repay_line_forwards_repay_and_withdraw() {
    let f = setup();
    f.env.mock_all_auths();
    f.client.open_line(&f.user, &10_0000000, &4_0000000);
    let line = f.client.repay_line(&f.user, &4_0000000, &10_0000000);
    assert_eq!(line.repaid, 4_0000000);
    assert_eq!(line.collateral_out, 10_0000000);
    let (_, _, _, requests) = f.pool.last();
    assert_eq!(requests.get(0).unwrap().request_type, REQUEST_REPAY);
    assert_eq!(requests.get(0).unwrap().address, f.debt);
    assert_eq!(requests.get(1).unwrap().request_type, REQUEST_WITHDRAW_COLLATERAL);
    assert_eq!(requests.get(1).unwrap().address, f.collateral);
}

#[test]
fn repay_without_line_fails() {
    let f = setup();
    f.env.mock_all_auths();
    assert!(f.client.try_repay_line(&f.user, &1_0000000, &0).is_err());
    assert_eq!(f.pool.calls(), 0);
}

#[test]
fn record_payout_updates_line_and_requires_line() {
    let f = setup();
    f.env.mock_all_auths();
    let tx = String::from_str(&f.env, "sep_0123");
    assert!(f.client.try_record_payout(&f.user, &tx, &250_00).is_err());
    f.client.open_line(&f.user, &10_0000000, &4_0000000);
    let line = f.client.record_payout(&f.user, &tx, &250_00);
    assert_eq!(line.payouts, 1);
    assert_eq!(line.payout_try, 250_00);
    assert!(f.client.try_record_payout(&f.user, &tx, &-1).is_err());
}

#[test]
fn positions_reads_through_to_pool_and_config_is_stored() {
    let f = setup();
    let positions = f.client.positions(&f.user);
    assert_eq!(positions.collateral.get(0).unwrap(), 5_000_000);
    let config = f.client.get_config();
    assert_eq!(config.admin, f.admin);
    assert_eq!(config.collateral_asset, f.collateral);
    assert_eq!(config.debt_asset, f.debt);
}
