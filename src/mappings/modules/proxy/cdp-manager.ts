import { Address, dataSource, log } from '@graphprotocol/graph-ts'

import {
  GebCDPManager,
  TransferCDPOwnership,
  OpenCdp,
  AllowCDP,
  AllowHandler,
} from '../../../../generated/GebCdpManager/GebCDPManager'
import { CollateralType, UserProxy, Cdp } from '../../../../generated/schema'

import { getSystemState } from '../../../entities'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

export function handleOpenCdp(event: OpenCdp): void {
  let manager = GebCDPManager.bind(dataSource.address())

  let collateralType = manager.collateralTypes(event.params.cdp)
  let cdpAddress = manager.cdps(event.params.cdp)

  let collateral = CollateralType.load(collateralType.toString())

  if (collateral != null) {
    let proxy = UserProxy.load(event.params.own.toHexString())

    // Register new vault
    let cdp = new Cdp(cdpAddress.toHexString() + '-' + collateral.id)
    cdp.cdpId = event.params.cdp
    cdp.collateralType = collateral.id
    cdp.collateral = decimal.ZERO
    cdp.debt = decimal.ZERO
    cdp.cdpHandler = cdpAddress

    cdp.owner = proxy != null ? Address.fromString(proxy.owner) : event.params.own

    if (proxy != null) {
      cdp.proxy = proxy.id
    }

    log.info('New Manged CDP, id: #{}, owner {}, address: {}', [
      cdp.cdpId.toString(),
      cdp.owner.toHexString(),
      cdpAddress.toHexString(),
    ])

    cdp.openedAt = event.block.timestamp
    cdp.openedAtBlock = event.block.number
    cdp.openedAtTransaction = event.transaction.hash

    // Update vault counter
    collateral.cdpCount = collateral.cdpCount.plus(integer.ONE)

    cdp.save()
    collateral.save()
  } else {
    log.warning('Wrong collateral type: {}, cdp_id: {}, tx_hash: {}', [
      collateralType.toString(),
      event.params.cdp.toString(),
      event.transaction.hash.toHexString(),
    ])
  }

  // Update system state
  let system = getSystemState(event)
  system.cdpCount = system.cdpCount.plus(integer.ONE)
  system.save()
}

export function handleTransferCDPOwnership(event: TransferCDPOwnership): void {
  let manager = GebCDPManager.bind(dataSource.address())
  let collateralType = manager.collateralTypes(event.params.cdp)
  let collateral = CollateralType.load(collateralType.toString())
  let cdpAddress = manager.cdps(event.params.cdp)
  let cdp = Cdp.load(cdpAddress.toHexString() + '-' + collateral.id)

  cdp.owner = event.params.dst
  cdp.save()
}

export function handleAllowCDP(event: AllowCDP): void {
  // TODO:
  log.warning('AllowCDP not implemented', [])
}

export function handleAllowHandler(event: AllowHandler): void {
  // TODO:
  log.warning('AllowHandler not implemented', [])
}
