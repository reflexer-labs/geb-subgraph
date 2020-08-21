import { Bytes, ethereum, Address, BigInt } from '@graphprotocol/graph-ts'
import { Cdp, UserProxy, CdpHandlerOwner } from '../../generated/schema'
import { getOrCreateCollateral, updateLastModifyCollateralType } from './collateral'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'
import { getSystemState, updateLastModifySystemState } from './system'
import { getOrCreateUser } from './user'

// There is 4 different CDP ownership relation possible:
// 1. Owner -> CDPEngine
// 2. Owner -> CDPManager -> CDPEngine
// 3. Owner -> Proxy -> CDPEngine
// 4. Owner -> Proxy -> CDPManager -> CDPEngine (Like on Oasis)

export function createManagedCdp(
  cdpHandler: Bytes,
  owner: Bytes,
  collateral: Bytes,
  cdpId: BigInt,
  event: ethereum.Event,
): Cdp {
  let collateralObj = getOrCreateCollateral(collateral, event)
  let system = getSystemState(event)
  let cdp = createCdp(cdpHandler, collateral, event)
  cdp.cdpId = cdpId

  // Ownership detection for managed CDPs (See explanations above)
  let proxy = UserProxy.load(owner.toHexString())
  if (proxy != null) {
    // Case 4
    cdp.owner = proxy.owner
    cdp.proxy = proxy.id
  } else {
    // Case 2
    cdp.owner = getOrCreateUser(owner).id
  }

  // Add an entry to the reverse lookup data structure
  let handlerOwner = new CdpHandlerOwner(cdpHandler.toHexString())
  handlerOwner.owner = cdp.owner
  handlerOwner.save()

  // Increase CDP counters
  collateralObj.cdpCount = collateralObj.unmanagedCdpCount.plus(integer.ONE)
  system.cdpCount = system.unmanagedCdpCount.plus(integer.ONE)

  updateLastModifyCollateralType(collateralObj, event)
  updateLastModifySystemState(system, event)

  collateralObj.save()
  system.save()
  cdp.save()

  return cdp
}

export function createUnmanagedCdp(cdpHandler: Bytes, collateral: Bytes, event: ethereum.Event): Cdp {
  let collateralObj = getOrCreateCollateral(collateral, event)
  let system = getSystemState(event)
  let cdp = createCdp(cdpHandler, collateral, event)

  // Ownership detection for unmanaged CDP (See explanation above)
  let proxy = UserProxy.load(cdpHandler.toHexString())
  if (proxy != null) {
    // Case 3
    cdp.owner = proxy.owner
    cdp.proxy = proxy.id
  } else {
    // Case 1
    cdp.owner = getOrCreateUser(cdpHandler).id
  }

  // Add an entry to the reverse lookup data structure
  let handlerOwner = new CdpHandlerOwner(cdpHandler.toHexString())
  handlerOwner.owner = cdp.owner
  handlerOwner.save()

  // Increase CDP counters
  collateralObj.unmanagedCdpCount = collateralObj.unmanagedCdpCount.plus(integer.ONE)
  system.unmanagedCdpCount = system.unmanagedCdpCount.plus(integer.ONE)

  updateLastModifyCollateralType(collateralObj, event)
  updateLastModifySystemState(system, event)

  collateralObj.save()
  system.save()
  cdp.save()

  return cdp
}

function createCdp(cdpHandler: Bytes, collateral: Bytes, event: ethereum.Event): Cdp {
  let id = cdpHandler.toHexString() + '-' + collateral.toString()

  let cdp = new Cdp(id)
  cdp.collateralType = collateral.toString()
  cdp.collateral = decimal.ZERO
  cdp.debt = decimal.ZERO
  cdp.cdpHandler = cdpHandler
  cdp.createdAt = event.block.timestamp
  cdp.createdAtBlock = event.block.number
  cdp.createdAtTransaction = event.transaction.hash
  return cdp
}

export function updateCdpCollateralization(
  cdp: Cdp,
  collateral: decimal.BigDecimal,
  debt: decimal.BigDecimal,
  event: ethereum.Event,
): void {
  let wasEmpty = isEmptyCdp(cdp)

  cdp.collateral = collateral
  cdp.debt = debt

  let system = getSystemState(event)

  if (wasEmpty && !isEmptyCdp(cdp)) {
    system.totalActiveCdpCount = system.totalActiveCdpCount.plus(integer.ONE)
  } else if (!wasEmpty && isEmptyCdp(cdp)) {
    system.totalActiveCdpCount = system.totalActiveCdpCount.minus(integer.ONE)
  }

  updateLastModifyCdp(cdp, event)

  cdp.save()
  system.save()
}

// @ts-ignore
function isEmptyCdp(cdp: Cdp): bool {
  return cdp.collateral.gt(decimal.ZERO) && cdp.debt.gt(decimal.ZERO)
}

export function updateLastModifyCdp(cdp: Cdp, event: ethereum.Event): void {
  cdp.modifiedAt = event.block.timestamp
  cdp.modifiedAtBlock = event.block.number
  cdp.modifiedAtTransaction = event.transaction.hash
}
