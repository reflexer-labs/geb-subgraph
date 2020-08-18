import { Bytes, ethereum, Address, BigInt } from '@graphprotocol/graph-ts'
import { Cdp, UserProxy } from '../../generated/schema'
import { getOrCreateCollateral, updateLastModifyCollateralType } from './collateral'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'
import { getSystemState, updateLastModifySystemState } from './system'

export function createManagedCdp(address: Bytes, collateral: Bytes, cdpId: BigInt, event: ethereum.Event) : Cdp {
  let collateralObj = getOrCreateCollateral(collateral, event)
  let system = getSystemState(event)
  let cdp = createCdp(address, collateral, event)
  collateralObj.cdpCount = collateralObj.unmanagedCdpCount.plus(integer.ONE)
  system.cdpCount = system.unmanagedCdpCount.plus(integer.ONE)
  
  updateLastModifyCollateralType(collateralObj, event)
  updateLastModifySystemState(system, event)

  collateralObj.save()
  system.save()
  cdp.save()
  
  return cdp 
}

export function createUnmanagedCdp(address: Bytes, collateral: Bytes, event: ethereum.Event): Cdp {
  let collateralObj = getOrCreateCollateral(collateral, event)
  let system = getSystemState(event)
  let cdp = createCdp(address, collateral, event)
  collateralObj.unmanagedCdpCount = collateralObj.unmanagedCdpCount.plus(integer.ONE)
  system.unmanagedCdpCount = system.unmanagedCdpCount.plus(integer.ONE)
  
  updateLastModifyCollateralType(collateralObj, event)
  updateLastModifySystemState(system, event)

  collateralObj.save()
  system.save()
  cdp.save()

  return cdp 
}

function createCdp(address: Bytes, collateral: Bytes, event: ethereum.Event): Cdp {
  let id = address.toHexString() + '-' + collateral.toString()
  let proxy = UserProxy.load(address.toHexString())

  let cdp = new Cdp(id)
  cdp.collateralType = collateral.toString()
  cdp.collateral = decimal.ZERO
  cdp.debt = decimal.ZERO
  cdp.cdpHandler = address

  if(proxy != null) {
    cdp.owner = Address.fromString(proxy.owner)
    cdp.proxy = proxy.id
  } else {
    cdp.owner = address
  }
  
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

function isEmptyCdp(cdp: Cdp): bool {
  return cdp.collateral.gt(decimal.ZERO) && cdp.debt.gt(decimal.ZERO)
}

export function updateLastModifyCdp(cdp: Cdp, event: ethereum.Event): void {
  cdp.modifiedAt = event.block.timestamp
  cdp.modifiedAtBlock = event.block.number
  cdp.modifiedAtTransaction = event.transaction.hash
}
