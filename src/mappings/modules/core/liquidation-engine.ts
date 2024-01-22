import {
  InitializeCollateralType,
  ModifyParameters as ModifyParameters,
  Liquidate,
  AddAuthorization,
  RemoveAuthorization,
  ConnectSAFESaviour,
  DisconnectSAFESaviour,
  ProtectSAFE,
} from '../../../../generated/LiquidationEngine/LiquidationEngine'

import { LiquidationEngine as LiquidationEngineBind } from '../../../../generated/LiquidationEngine/LiquidationEngine'

import {
  FixedDiscountCollateralAuctionHouse,
} from '../../../../generated/templates'
import { FixedDiscountCollateralAuctionHouse as FixedDiscountCollateralAuctionHouseBind } from '../../../../generated/templates/FixedDiscountCollateralAuctionHouse/FixedDiscountCollateralAuctionHouse'
import {
  getOrCreateCollateral,
  Safe,
  DiscountAuction,
  EnglishAuction,
  SafeSaviour,
} from '../../../entities'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import * as bytes from '../../../utils/bytes'

import { log, BigInt, dataSource } from '@graphprotocol/graph-ts'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// Register a new collateral type
export function handleInitializeCollateralType(event: InitializeCollateralType): void {
  let collateral = getOrCreateCollateral(event.params._cType, event)
  let liquidationEngineContract = LiquidationEngineBind.bind(dataSource.address())

  let liqParams = liquidationEngineContract.cParams(event.params._cType)

  collateral.liquidationPenalty = decimal.fromWad(liqParams.liquidationPenalty)
  collateral.liquidationQuantity = decimal.fromRad(liqParams.liquidationQuantity)
  collateral.collateralAuctionHouseAddress = liqParams.collateralAuctionHouse

  collateral.save()

  log.info('Onboard new collateral Liq Engine {} {} {} {}', [collateral.id, liqParams.liquidationPenalty.toString(), liqParams.liquidationQuantity.toString(), liqParams.collateralAuctionHouse.toHexString()])

}

export function handleModifyParameters(
  event: ModifyParameters,
): void {
  let what = event.params._param.toString()
  let collateral = getOrCreateCollateral(event.params._cType, event)

  if (what == 'liquidationPenalty') {
    let data = BigInt.fromUnsignedBytes(event.params._data)
    collateral.liquidationPenalty = decimal.fromWad(data)
  } else if (what == 'liquidationQuantity') {
    let data = BigInt.fromUnsignedBytes(event.params._data)
    collateral.liquidationQuantity = decimal.fromRad(data)
  } else if (what == 'collateralAuctionHouse') {
    // Configure auction type

    let address = event.params._data
    collateral.collateralAuctionHouseAddress = address

    // Detect the type of auction
    let auctionHouse = FixedDiscountCollateralAuctionHouseBind.bind(bytes.toAddress(address))
    let auctionType = auctionHouse.AUCTION_TYPE().toString()

    if (auctionType == enums.AuctionType_ENGLISH) {
      log.info('English auction set for collateral {}', [collateral.id])

      // Default auction config
      let auctionConfiguration = getOrCreateEnglishAuctionConfiguration(address, collateral.id)

      collateral.auctionType = enums.AuctionType_ENGLISH
      collateral.englishAuctionConfiguration = auctionConfiguration.id

      // Start indexing an instance of english auction contract
      FixedDiscountCollateralAuctionHouse.create(bytes.toAddress(address))
      log.info('Start indexing english auction house: {}', [address.toHexString()])
    } else if (auctionType == enums.AuctionType_FIXED_DISCOUNT) {
      collateral.auctionType = enums.AuctionType_FIXED_DISCOUNT

      // Start indexing an instance of fixed discount auction contract
      FixedDiscountCollateralAuctionHouse.create(bytes.toAddress(address))
      log.info('Start indexing fixed discount auction house: {}', [address.toHexString()])
    } else if (auctionType == enums.AuctionType_INCREASING_DISCOUNT) {
      collateral.auctionType = enums.AuctionType_INCREASING_DISCOUNT

      // Start indexing an instance of fixed discount auction contract
      FixedDiscountCollateralAuctionHouse.create(bytes.toAddress(address))

      log.info('Start indexing increasing discount auction house: {}', [address.toHexString()])
    } else {
      log.error('Unknown auction type: {} ', [auctionType as string])
    }
  }

  collateral.save()
}

export function handleLiquidate(event: Liquidate): void {
  let id = event.params._auctionId
  let collateral = getOrCreateCollateral(event.params._cType, event)
  log.info('Start liquidation id {} of collateral {}', [id.toString(), collateral.id])

  if (collateral.auctionType == enums.AuctionType_ENGLISH) {
    let config = getOrCreateEnglishAuctionConfiguration(
      collateral.collateralAuctionHouseAddress,
      enums.EnglishAuctionType_LIQUIDATION,
    )

    if (config == null) {
      log.error('handleLiquidate - auction configuration {} not found', [collateral.id])
    }

    let liquidation = new EnglishAuction(event.params._collateralAuctioneer.toHexString() + '-' + id.toString())

    liquidation.auctionId = id
    liquidation.numberOfBids = integer.ZERO
    liquidation.englishAuctionType = enums.EnglishAuctionType_LIQUIDATION
    liquidation.buyToken = enums.AuctionToken_COIN
    liquidation.sellToken = enums.AuctionToken_COLLATERAL
    liquidation.sellInitialAmount = decimal.fromWad(event.params._collateralAmount)
    liquidation.buyInitialAmount = decimal.ZERO
    liquidation.sellAmount = liquidation.sellInitialAmount
    liquidation.buyAmount = liquidation.buyInitialAmount
    liquidation.targetAmount = decimal.fromRad(event.params._amountToRaise)
    liquidation.startedBy = event.address
    liquidation.isClaimed = false
    liquidation.createdAt = event.block.timestamp
    liquidation.createdAtBlock = event.block.number
    liquidation.createdAtTransaction = event.transaction.hash
    liquidation.englishAuctionConfiguration = collateral.id
    liquidation.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

    let safe = Safe.load(event.params._safe.toHexString() + '-' + collateral.id)
    if (safe != null) {
      liquidation.safe = safe.id
    }

    liquidation.save()
  } else if (collateral.auctionType == enums.AuctionType_FIXED_DISCOUNT || collateral.auctionType == enums.AuctionType_INCREASING_DISCOUNT) {
    let liquidation = new DiscountAuction(event.params._collateralAuctioneer.toHexString() + '-' + id.toString())

    liquidation.auctionId = id
    liquidation.collateralType = collateral.id
    liquidation.safeHandler = event.params._safe
    liquidation.sellInitialAmount = decimal.fromWad(event.params._collateralAmount)
    liquidation.amountToRaise = decimal
      .fromRad(event.params._amountToRaise)
      .times(collateral.liquidationPenalty)
    liquidation.buyAmount = decimal.ZERO
    liquidation.sellAmount = liquidation.sellInitialAmount
    let safe = Safe.load(event.params._safe.toHexString() + '-' + collateral.id)
    if (safe != null) {
      liquidation.safe = safe.id
    }
    liquidation.startedBy = event.address
    liquidation.numberOfBatches = integer.ZERO
    liquidation.isTerminated = false
    liquidation.isSettled = false
    liquidation.createdAt = event.block.timestamp
    liquidation.createdAtBlock = event.block.number
    liquidation.createdAtTransaction = event.transaction.hash
    liquidation.save()
  }

  // Update collateral variables
  collateral.liquidationsStarted = collateral.liquidationsStarted.plus(integer.ONE)
  collateral.activeLiquidations = collateral.activeLiquidations.plus(integer.ONE)
  collateral.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params._account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params._account, event)
}

export function handleConnectSAFESaviour(event: ConnectSAFESaviour): void {
  let saviour = SafeSaviour.load(event.params._saviour.toHexString())

  if (!saviour) {
    saviour = new SafeSaviour(event.params._saviour.toHexString())
    saviour.successSaveCount = integer.ZERO
    saviour.failSaveCount = integer.ZERO
  }
  saviour.allowed = true
  saviour.save()
}

export function handleDisconnectSAFESaviour(event: DisconnectSAFESaviour): void {
  let saviour = SafeSaviour.load(event.params._saviour.toHexString())
  if (!saviour) {
    log.error('Try to load non existing saviour', [])
  } else {
    saviour.allowed = false
    saviour.save()
  }
}

export function handleProtectSAFE(event: ProtectSAFE): void {
  let collateral = getOrCreateCollateral(event.params._cType, event)
  let safe = Safe.load(event.params._safe.toHexString() + '-' + collateral.id)

  if (!safe) {
    log.error('Try to add saviour to non existing safe', [])
  } else {
    safe.saviour = event.params._saviour.toHexString()
    safe.save()
  }
}
