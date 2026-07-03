#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, Vec,
};

pub const TOTAL_SHARES: u32 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NoRecipients = 1,
    LengthMismatch = 2,
    ZeroShare = 3,
    BadShareTotal = 4,
    SplitNotFound = 5,
    SplitImmutable = 6,
    InvalidAmount = 7,
}

#[contracttype]
#[derive(Clone)]
pub struct Split {
    pub recipients: Vec<Address>,
    pub shares: Vec<u32>,
    pub controller: Option<Address>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Count,
    Split(u64),
}

#[contractevent]
#[derive(Clone)]
pub struct SplitCreated {
    #[topic]
    pub id: u64,
    pub creator: Address,
}

#[contractevent]
#[derive(Clone)]
pub struct SplitPaid {
    #[topic]
    pub id: u64,
    pub token: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone)]
pub struct SplitUpdated {
    #[topic]
    pub id: u64,
}

#[contract]
pub struct Splitter;

#[contractimpl]
impl Splitter {
    /// Registers a new split and returns its id. Shares are basis points
    /// and must sum to exactly 10_000. Passing a controller makes the
    /// split mutable by that address; passing None locks it forever.
    pub fn create_split(
        env: Env,
        creator: Address,
        recipients: Vec<Address>,
        shares: Vec<u32>,
        controller: Option<Address>,
    ) -> Result<u64, Error> {
        creator.require_auth();
        validate(&recipients, &shares)?;

        let id: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let split = Split {
            recipients,
            shares,
            controller,
        };
        env.storage().persistent().set(&DataKey::Split(id), &split);
        env.storage().instance().set(&DataKey::Count, &(id + 1));
        SplitCreated { id, creator }.publish(&env);
        Ok(id)
    }

    /// Moves `amount` of `token` from the payer to every recipient of the
    /// split in one call. Rounding dust goes to the last recipient.
    pub fn pay(
        env: Env,
        from: Address,
        id: u64,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let split = load(&env, id)?;
        payout(&env, &split, &from, &token, amount);
        SplitPaid { id, token, amount }.publish(&env);
        Ok(())
    }

    /// Replaces the recipients and shares of a mutable split.
    pub fn update_split(
        env: Env,
        id: u64,
        recipients: Vec<Address>,
        shares: Vec<u32>,
    ) -> Result<(), Error> {
        let mut split = load(&env, id)?;
        let controller = split.controller.clone().ok_or(Error::SplitImmutable)?;
        controller.require_auth();
        validate(&recipients, &shares)?;
        split.recipients = recipients;
        split.shares = shares;
        env.storage().persistent().set(&DataKey::Split(id), &split);
        SplitUpdated { id }.publish(&env);
        Ok(())
    }

    pub fn get_split(env: Env, id: u64) -> Result<Split, Error> {
        load(&env, id)
    }

    pub fn split_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}

fn validate(recipients: &Vec<Address>, shares: &Vec<u32>) -> Result<(), Error> {
    if recipients.is_empty() {
        return Err(Error::NoRecipients);
    }
    if recipients.len() != shares.len() {
        return Err(Error::LengthMismatch);
    }
    let mut total: u32 = 0;
    for share in shares.iter() {
        if share == 0 {
            return Err(Error::ZeroShare);
        }
        total = total.checked_add(share).ok_or(Error::BadShareTotal)?;
    }
    if total != TOTAL_SHARES {
        return Err(Error::BadShareTotal);
    }
    Ok(())
}

fn payout(env: &Env, split: &Split, from: &Address, token: &Address, amount: i128) {
    let client = token::Client::new(env, token);
    let last = split.recipients.len() - 1;
    let mut paid: i128 = 0;
    for i in 0..split.recipients.len() {
        let recipient = split.recipients.get_unchecked(i);
        let part = if i == last {
            amount - paid
        } else {
            amount * split.shares.get_unchecked(i) as i128 / TOTAL_SHARES as i128
        };
        if part > 0 {
            client.transfer(from, &recipient, &part);
            paid += part;
        }
    }
}

fn load(env: &Env, id: u64) -> Result<Split, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Split(id))
        .ok_or(Error::SplitNotFound)
}

#[cfg(test)]
mod test;
