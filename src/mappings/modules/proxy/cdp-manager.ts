import { dataSource, log } from '@graphprotocol/graph-ts'

import {
  GebCDPManager,
  TransferCDPOwnership,
  OpenCdp,
  AllowCDP,
  AllowHandler,
} from '../../../../generated/GebCDPManager/GebCDPManager'
import { CollateralType, Cdp, InternalBondBalance, InternalDebtBalance, InternalCollateralBalance } from '../../../../generated/schema'

import { updateLastModifyCdp, createManagedCdp } from '../../../entities/cdp'
import { findUltimateOwner } from '../../../entities/user'

export function handleOpenCdp(event: OpenCdp): void {
  let manager = GebCDPManager.bind(dataSource.address())

  let collateralType = manager.collateralTypes(event.params.cdp)
  let cdpAddress = manager.cdps(event.params.cdp)

  let collateral = CollateralType.load(collateralType.toString())

  if (collateral != null) {
    // Register new vault
    let cdp = createManagedCdp(cdpAddress, event.params.own, collateralType, event.params.cdp, event)
    log.info('New Manged CDP, id: #{}, owner {}, address: {}', [
      cdp.cdpId.toString(),
      cdp.owner,
      cdpAddress.toHexString(),
    ])
    cdp.save()
  } else {
    log.warning('Wrong collateral type: {}, cdp_id: {}, tx_hash: {}', [
      collateralType.toString(),
      event.params.cdp.toString(),
      event.transaction.hash.toHexString(),
    ])
  }
}

export function handleTransferCDPOwnership(event: TransferCDPOwnership): void {
  let manager = GebCDPManager.bind(dataSource.address())
  let collateralType = manager.collateralTypes(event.params.cdp)
  let collateral = CollateralType.load(collateralType.toString())
  let cdpHandler = manager.cdps(event.params.cdp)
  let cdp = Cdp.load(cdpHandler.toHexString() + '-' + collateral.id)
  cdp.owner = findUltimateOwner(event.params.dst).toHexString()
  updateLastModifyCdp(cdp as Cdp, event)
  cdp.save()

  // Transfers balances ownership
  let bondBalance = InternalBondBalance.load(cdpHandler.toHexString())
  if(bondBalance) bondBalance.owner = cdp.owner
  let debtBalance = InternalDebtBalance.load(cdpHandler.toHexString())
  if(debtBalance) debtBalance.owner = cdp.owner
  let collateralBalance = InternalCollateralBalance.load(cdpHandler.toHexString() + '-' + collateralType.toString())
  if(collateralBalance) collateralBalance.owner = cdp.owner
}

export function handleAllowCDP(event: AllowCDP): void {
  // TODO:
  log.warning('AllowCDP not implemented', [])
}

export function handleAllowHandler(event: AllowHandler): void {
  // TODO:
  log.warning('AllowHandler not implemented', [])
}
