#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String};

#[contracttype]
pub enum DataKey {
    Admin,
    Decimals,
    Name,
    Symbol,
    Balance(Address),
    Authorized(Address),
}

#[contracterror]
#[derive(Debug, Clone, PartialEq)]
pub enum TokenError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NotAuthorized = 4,
    NegativeAmount = 5,
    InsufficientBalance = 6,
}

#[contract]
pub struct VflyToken;

#[contractimpl]
impl VflyToken {
    pub fn initialize(
        env: Env,
        admin: Address,
        decimals: u32,
        name: String,
        symbol: String,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TokenError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        Ok(())
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount < 0 {
            return Err(TokenError::NegativeAmount);
        }
        let admin = Self::get_admin(&env)?;
        admin.require_auth();
        let balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(balance + amount));
        Ok(())
    }

    pub fn set_authorized(env: Env, id: Address, authorize: bool) -> Result<(), TokenError> {
        let admin = Self::get_admin(&env)?;
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Authorized(id), &authorize);
        Ok(())
    }

    pub fn authorized(env: Env, id: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Authorized(id))
            .unwrap_or(false)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        from.require_auth();
        if !Self::authorized(env.clone(), from.clone()) {
            return Err(TokenError::NotAuthorized);
        }
        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(to_balance + amount));
        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, TokenError> {
        Self::get_admin(&env)
    }

    pub fn decimals(env: Env) -> Result<u32, TokenError> {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .ok_or(TokenError::NotInitialized)
    }

    pub fn name(env: Env) -> Result<String, TokenError> {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .ok_or(TokenError::NotInitialized)
    }

    pub fn symbol(env: Env) -> Result<String, TokenError> {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .ok_or(TokenError::NotInitialized)
    }

    fn get_admin(env: &Env) -> Result<Address, TokenError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env, String};

    fn setup() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(VflyToken, ());
        let admin = Address::generate(&env);
        (env, contract_id, admin)
    }

    #[test]
    fn test_initialize_sets_admin() {
        let (env, contract_id, admin) = setup();
        let client = VflyTokenClient::new(&env, &contract_id);
        client.initialize(
            &admin,
            &7,
            &String::from_str(&env, "VeriFlo"),
            &String::from_str(&env, "VFLY"),
        );
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn test_mint_by_admin_succeeds() {
        let (env, contract_id, admin) = setup();
        let client = VflyTokenClient::new(&env, &contract_id);
        client.initialize(
            &admin,
            &7,
            &String::from_str(&env, "VeriFlo"),
            &String::from_str(&env, "VFLY"),
        );
        let user = Address::generate(&env);
        client.mint(&user, &1_000_000_000);
        assert_eq!(client.balance(&user), 1_000_000_000);
    }

    #[test]
    fn test_mint_by_non_admin_fails() {
        // Fresh env with NO mocked auths — auth checks are enforced
        let env = Env::default();
        let contract_id = env.register(VflyToken, ());
        let admin = Address::generate(&env);

        // initialize does not call require_auth itself, so it works without mocking
        let client = VflyTokenClient::new(&env, &contract_id);
        client.initialize(
            &admin,
            &7,
            &String::from_str(&env, "VeriFlo"),
            &String::from_str(&env, "VFLY"),
        );

        // mint calls admin.require_auth() — no auth is mocked, so this must fail
        let result = client.try_mint(&Address::generate(&env), &500);
        assert!(result.is_err());
    }

    #[test]
    fn test_set_authorized_by_admin_succeeds() {
        let (env, contract_id, admin) = setup();
        let client = VflyTokenClient::new(&env, &contract_id);
        client.initialize(
            &admin,
            &7,
            &String::from_str(&env, "VeriFlo"),
            &String::from_str(&env, "VFLY"),
        );
        let user = Address::generate(&env);
        assert!(!client.authorized(&user));
        client.set_authorized(&user, &true);
        assert!(client.authorized(&user));
    }

    #[test]
    fn test_transfer_unauthorized_fails() {
        let (env, contract_id, admin) = setup();
        let client = VflyTokenClient::new(&env, &contract_id);
        client.initialize(
            &admin,
            &7,
            &String::from_str(&env, "VeriFlo"),
            &String::from_str(&env, "VFLY"),
        );
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        // Mint to from but do NOT authorize
        client.mint(&from, &500);
        let result = client.try_transfer(&from, &to, &100);
        assert!(result.is_err());
    }
}
