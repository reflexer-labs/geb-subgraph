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
import { SAFEEngine } from '../../generated/SAFEEngine/SAFEEngine'
import { addressMap } from '../utils/addresses'
import { getSystemState } from './system'

// --- Coin balance ---

export function updateCoinBalance(owner: Address, event: ethereum.Event): void {
  let balance = getOrCreateCoinBalance(owner, event)
  let safeEngine = SAFEEngine.bind(event.address)
  let bal = decimal.fromRad(safeEngine.coinBalance(owner))

  balance.balance = bal
  balance.modifiedAt = event.block.timestamp
  balance.modifiedAtBlock = event.block.number
  balance.modifiedAtTransaction = event.transaction.hash
  balance.save()

  if (owner.equals(addressMap.get('GEB_ACCOUNTING_ENGINE'))) {
    // Update the accounting engine status vars
    setAccountingEngineParams(safeEngine, event)
  }
}

function getOrCreateCoinBalance(address: Bytes, event: ethereum.Event): InternalCoinBalance {
  let bal = InternalCoinBalance.load(address.toHexString())
  if (bal != null) {
    return bal as InternalCoinBalance
  } else {
    return createCoinBalance(address, decimal.ZERO, event)
  }
}

function createCoinBalance(
  address: Bytes,
  balance: BigDecimal,
  event: ethereum.Event,
): InternalCoinBalance {
  let bal = new InternalCoinBalance(address.toHexString())
  bal.accountHandler = address
  bal.owner = getOrCreateUser(findUltimateOwner(address)).id
  let proxy = findProxy(address)
  if (proxy != null) {
    bal.proxy = proxy.id
  }
  bal.balance = balance
  bal.createdAt = event.block.timestamp
  bal.createdAtBlock = event.block.number
  bal.createdAtTransaction = event.transaction.hash
  return bal
}

function setAccountingEngineParams(safeEngine: SAFEEngine, event: ethereum.Event): void {
  let system = getSystemState(event)
  let coinBal = decimal.fromRad(safeEngine.coinBalance(addressMap.get('GEB_ACCOUNTING_ENGINE')))
  let debtBal = decimal.fromRad(safeEngine.debtBalance(addressMap.get('GEB_ACCOUNTING_ENGINE')))

  // Set this to the min between coin balance and debt balance
  system.debtAvailableToSettle = coinBal >= debtBal ? debtBal : coinBal

  // Set the surplus to coin balance minus debt balance
  system.systemSurplus = coinBal.minus(debtBal)
  system.save()
}

// --- Collateral balance ---

export function updateCollateralBalance(
  owner: Address,
  collateralType: Bytes,
  event: ethereum.Event,
): void {
  let balance = getOrCreateCollateralBalance(owner, collateralType, event)
  let safeEngine = SAFEEngine.bind(event.address)
  let bal = decimal.fromWad(safeEngine.tokenCollateral(collateralType, owner))

  balance.balance = bal
  balance.modifiedAt = event.block.timestamp
  balance.modifiedAtBlock = event.block.number
  balance.modifiedAtTransaction = event.transaction.hash
  balance.save()
}

function getOrCreateCollateralBalance(
  address: Bytes,
  collateralType: Bytes,
  event: ethereum.Event,
): InternalCollateralBalance {
  let bal = InternalCollateralBalance.load(address.toHexString() + '-' + collateralType.toString())
  if (bal != null) {
    return bal as InternalCollateralBalance
  } else {
    return createCollateralBalance(address, collateralType, decimal.ZERO, event)
  }
}

function createCollateralBalance(
  address: Bytes,
  collateralType: Bytes,
  balance: BigDecimal,
  event: ethereum.Event,
): InternalCollateralBalance {
  let bal = new InternalCollateralBalance(address.toHexString() + '-' + collateralType.toString())
  bal.accountHandler = address
  bal.owner = getOrCreateUser(findUltimateOwner(address)).id
  let proxy = findProxy(address)
  if (proxy != null) {
    bal.proxy = proxy.id
  }
  bal.collateralType = collateralType.toString()
  bal.balance = balance
  bal.createdAt = event.block.timestamp
  bal.createdAtBlock = event.block.number
  bal.createdAtTransaction = event.transaction.hash

  return bal
}

// --- Debt balance ---

export function updateDebtBalance(owner: Address, event: ethereum.Event): void {
  let balance = getOrCreateDebtBalance(owner, event)
  let safeEngine = SAFEEngine.bind(event.address)
  let bal = decimal.fromRad(safeEngine.debtBalance(owner))
  balance.balance = bal
  balance.modifiedAt = event.block.timestamp
  balance.modifiedAtBlock = event.block.number
  balance.modifiedAtTransaction = event.transaction.hash
  balance.save()

  if (owner.equals(addressMap.get('GEB_ACCOUNTING_ENGINE'))) {
    // Update the accounting engine status vars
    setAccountingEngineParams(safeEngine, event)
  }
}

function getOrCreateDebtBalance(
  address: Bytes,
  event: ethereum.Event,
  // @ts-ignore
): InternalDebtBalance {
  let bal = InternalDebtBalance.load(address.toHexString())
  if (bal != null) {
    return bal as InternalDebtBalance
  } else {
    return createDebtBalance(address, decimal.ZERO, event)
  }
}

function createDebtBalance(
  address: Bytes,
  balance: BigDecimal,
  event: ethereum.Event,
): InternalDebtBalance {
  let bal = new InternalDebtBalance(address.toHexString())
  bal.accountHandler = address
  bal.owner = address.toHexString()
  bal.balance = balance
  bal.createdAt = event.block.timestamp
  bal.createdAtBlock = event.block.number
  bal.createdAtTransaction = event.transaction.hash

  return bal
}
