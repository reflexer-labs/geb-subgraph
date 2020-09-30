import { Bytes, BigDecimal, ethereum, Address, log } from '@graphprotocol/graph-ts'
import {
  UserProxy,
  InternalCoinBalance,
  InternalCollateralBalance,
  InternalDebtBalance,
  Safe,
  SafeHandlerOwner,
  User,
} from '../../generated/schema'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'
import { getOrCreateUser, findUltimateOwner } from './user'
import { findProxy } from '../mappings/modules/proxy/proxy-factory'

// --- Coin balance ---

export function getOrCreateCoinBalance(
  address: Bytes,
  event: ethereum.Event,
  // @ts-ignore
  canCreate: bool = true,
): InternalCoinBalance {
  let bal = InternalCoinBalance.load(address.toHexString())
  if (bal != null) {
    return bal as InternalCoinBalance
  } else {
    if (!canCreate) {
      log.error(" Coin balance of address {} not found and can't created", [address.toHexString()])
    }
    return createCoinBalance(address, decimal.ZERO, event)
  }
}

export function createCoinBalance(address: Bytes, balance: BigDecimal, event: ethereum.Event): InternalCoinBalance {
  let bal = new InternalCoinBalance(address.toHexString())
  bal.accountHandler = address
  bal.owner = getOrCreateUser(findUltimateOwner(address)).id
  bal.proxy = findProxy(address).id
  bal.balance = balance
  bal.createdAt = event.block.timestamp
  bal.createdAtBlock = event.block.number
  bal.createdAtTransaction = event.transaction.hash

  return bal
}

export function updateCoinBalance(balance: InternalCoinBalance, amount: BigDecimal, event: ethereum.Event): void {
  balance.balance = amount
  balance.modifiedAt = event.block.timestamp
  balance.modifiedAtBlock = event.block.number
  balance.modifiedAtTransaction = event.transaction.hash
}

// --- Collateral balance ---

export function getOrCreateCollateralBalance(
  address: Bytes,
  collateralType: Bytes,
  event: ethereum.Event,
  // @ts-ignore
  canCreate: bool = true,
): InternalCollateralBalance {
  let bal = InternalCollateralBalance.load(address.toHexString() + '-' + collateralType.toString())
  if (bal != null) {
    return bal as InternalCollateralBalance
  } else {
    if (!canCreate) {
      log.error(" Collateral balance of address {} not found and can't be created", [address.toHexString()])
    }
    return createCollateralBalance(address, collateralType, decimal.ZERO, event)
  }
}

export function createCollateralBalance(
  address: Bytes,
  collateralType: Bytes,
  balance: BigDecimal,
  event: ethereum.Event,
): InternalCollateralBalance {
  let bal = new InternalCollateralBalance(address.toHexString() + '-' + collateralType.toString())
  bal.accountHandler = address
  bal.owner = getOrCreateUser(findUltimateOwner(address)).id
  bal.proxy = findProxy(address).id
  bal.collateralType = collateralType.toString()
  bal.balance = balance
  bal.createdAt = event.block.timestamp
  bal.createdAtBlock = event.block.number
  bal.createdAtTransaction = event.transaction.hash

  return bal
}

export function updateCollateralBalance(
  balance: InternalCollateralBalance,
  amount: BigDecimal,
  event: ethereum.Event,
): void {
  balance.balance = amount
  balance.modifiedAt = event.block.timestamp
  balance.modifiedAtBlock = event.block.number
  balance.modifiedAtTransaction = event.transaction.hash
}

// --- Debt balance ---
export function getOrCreateDebtBalance(
  address: Bytes,
  event: ethereum.Event,
  // @ts-ignore
  canCreate: bool = true,
): InternalDebtBalance {
  let bal = InternalDebtBalance.load(address.toHexString())
  if (bal != null) {
    return bal as InternalDebtBalance
  } else {
    if (!canCreate) {
      log.error(" Debt balance of address {} not found and can't create", [address.toHexString()])
    }
    return createDebtBalance(address, decimal.ZERO, event)
  }
}

export function createDebtBalance(address: Bytes, balance: BigDecimal, event: ethereum.Event): InternalDebtBalance {
  let bal = new InternalDebtBalance(address.toHexString())
  bal.accountHandler = address
  bal.owner = address.toHexString()
  bal.balance = balance
  bal.createdAt = event.block.timestamp
  bal.createdAtBlock = event.block.number
  bal.createdAtTransaction = event.transaction.hash

  return bal
}

export function updateDebtBalance(balance: InternalDebtBalance, amount: BigDecimal, event: ethereum.Event): void {
  balance.balance = amount
  balance.modifiedAt = event.block.timestamp
  balance.modifiedAtBlock = event.block.number
  balance.modifiedAtTransaction = event.transaction.hash
}
