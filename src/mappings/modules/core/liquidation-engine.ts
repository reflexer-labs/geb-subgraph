import {
  ModifyParameters2 as ModifyParametersCollateralTypeUint,
  ModifyParameters3 as ModifyParametersCollateralTypeAddress,
  Liquidate,
  AddAuthorization,
  RemoveAuthorization,
  ConnectSAFESaviour,
  DisconnectSAFESaviour,
  ProtectSAFE,
} from '../../../../generated/LiquidationEngine/LiquidationEngine'

import { FixedDiscountCollateralAuctionHouse } from '../../../../generated/templates'
import { FixedDiscountCollateralAuctionHouse as FixedDiscountCollateralAuctionHouseBind } from '../../../../generated/templates/FixedDiscountCollateralAuctionHouse/FixedDiscountCollateralAuctionHouse'
import {
  getOrCreateCollateral,
  Safe,
  FixedDiscountAuction,
  FixedDiscountAuctionConfiguration,
  EnglishAuction,
  SafeSaviour,
} from '../../../entities'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

import { log } from '@graphprotocol/graph-ts'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

export function handleModifyParametersCollateralTypeUint(
  event: ModifyParametersCollateralTypeUint,
): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  if (what == 'liquidationPenalty') {
    collateral.liquidationPenalty = decimal.fromWad(event.params.data)
  } else if (what == 'liquidationQuantity') {
    collateral.liquidationQuantity = decimal.fromRad(event.params.data)
  }

  collateral.save()
}

export function handleModifyParametersCollateralTypeAddress(
  event: ModifyParametersCollateralTypeAddress,
): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  if (what == 'collateralAuctionHouse') {
    // Configure auction type

    let address = event.params.data
    collateral.collateralAuctionHouseAddress = address

    // Detect the type of auction
    let auctionHouse = FixedDiscountCollateralAuctionHouseBind.bind(address)
    let auctionType = auctionHouse.AUCTION_TYPE().toString()

    if (auctionType == enums.AuctionType_ENGLISH) {
      log.info('English auction set for collateral {}', [collateral.id])

      // Default auction config
      let auctionConfiguration = getOrCreateEnglishAuctionConfiguration(address, collateral.id)

      collateral.auctionType = enums.AuctionType_ENGLISH
      collateral.englishAuctionConfiguration = auctionConfiguration.id

      // Start indexing an instance of english auction contract
      FixedDiscountCollateralAuctionHouse.create(address)
      log.info('Start indexing english auction house: {}', [address.toHexString()])
    } else if (auctionType == enums.AuctionType_FIXED_DISCOUNT) {
      // Default auction config
      let auctionConfiguration = FixedDiscountAuctionConfiguration.load(collateral.id)
      if (auctionConfiguration == null) {
        auctionConfiguration = new FixedDiscountAuctionConfiguration(collateral.id)
      }
      auctionConfiguration.collateralType = collateral.id
      auctionConfiguration.minimumBid = decimal.fromNumber(5)
      auctionConfiguration.totalAuctionLength = integer.DAY.times(integer.fromNumber(7))
      auctionConfiguration.discount = decimal.fromNumber(0.95)
      auctionConfiguration.lowerCollateralMedianDeviation = decimal.fromNumber(0.9)
      auctionConfiguration.upperCollateralMedianDeviation = decimal.fromNumber(0.95)
      auctionConfiguration.lowerSystemCoinMedianDeviation = decimal.ONE
      auctionConfiguration.upperSystemCoinMedianDeviation = decimal.ONE
      auctionConfiguration.minSystemCoinMedianDeviation = decimal.fromNumber(0.999)
      auctionConfiguration.save()

      collateral.auctionType = enums.AuctionType_FIXED_DISCOUNT
      collateral.fixedDiscountAuctionConfiguration = auctionConfiguration.id

      // Start indexing an instance of fixed discount auction contract
      FixedDiscountCollateralAuctionHouse.create(address)
      log.info('Start indexing fixed discount auction house: {}', [address.toHexString()])
    } else {
      log.error('Unknown auction type: {} ', [auctionType as string])
    }
  }

  collateral.save()
}

export function handleLiquidate(event: Liquidate): void {
  let id = event.params.auctionId
  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  log.info('Start liquidation id {} of collateral {}', [id.toString(), collateral.id])

  if (collateral.auctionType == enums.AuctionType_ENGLISH) {
    let config = getOrCreateEnglishAuctionConfiguration(
      collateral.collateralAuctionHouseAddress,
      enums.EnglishAuctionType_LIQUIDATION,
    )

    if (config == null) {
      log.error('handleLiquidate - auction configuration {} not found', [collateral.id])
    }

    let liquidation = new EnglishAuction(collateral.id.toString() + '-' + id.toString())

    liquidation.auctionId = id
    liquidation.numberOfBids = integer.ZERO
    liquidation.englishAuctionType = enums.EnglishAuctionType_LIQUIDATION
    liquidation.buyToken = enums.AuctionToken_COIN
    liquidation.sellToken = enums.AuctionToken_COLLATERAL
    liquidation.sellInitialAmount = decimal.fromWad(event.params.collateralAmount)
    liquidation.buyInitialAmount = decimal.ZERO
    liquidation.sellAmount = liquidation.sellInitialAmount
    liquidation.buyAmount = liquidation.buyInitialAmount
    liquidation.targetAmount = decimal.fromRad(event.params.amountToRaise)
    liquidation.startedBy = event.address
    liquidation.isClaimed = false
    liquidation.createdAt = event.block.timestamp
    liquidation.createdAtBlock = event.block.number
    liquidation.createdAtTransaction = event.transaction.hash
    liquidation.englishAuctionConfiguration = collateral.id
    liquidation.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

    let safe = Safe.load(event.params.safe.toHexString() + '-' + collateral.id)
    liquidation.safe = safe.id

    liquidation.save()
  } else if (collateral.auctionType == enums.AuctionType_FIXED_DISCOUNT) {
    let config = FixedDiscountAuctionConfiguration.load(collateral.id)

    if (config == null) {
      log.error('handleLiquidate - auction configuration {} not found', [collateral.id])
    }

    let liquidation = new FixedDiscountAuction(collateral.id.toString() + '-' + id.toString())

    liquidation.auctionId = id
    liquidation.collateralType = collateral.id
    liquidation.safeHandler = event.params.safe
    liquidation.sellInitialAmount = decimal.fromWad(event.params.collateralAmount)
    liquidation.amountToRaise = decimal.fromRad(event.params.amountToRaise)
    liquidation.buyAmount = decimal.ZERO
    liquidation.sellAmount = liquidation.sellInitialAmount
    let safe = Safe.load(event.params.safe.toHexString() + '-' + collateral.id)
    liquidation.safe = safe.id
    liquidation.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)
    liquidation.startedBy = event.address
    liquidation.numberOfBatches = integer.ZERO
    liquidation.fixedDiscountAuctionConfiguration = collateral.id
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
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}

export function handleConnectSAFESaviour(event: ConnectSAFESaviour): void {
  let saviour = SafeSaviour.load(event.params.saviour.toHexString())

  if (!saviour) {
    saviour = new SafeSaviour(event.params.saviour.toHexString())
    saviour.successSaveCount = integer.ZERO
    saviour.failSaveCount = integer.ZERO
  }
  saviour.allowed = true
  saviour.save()
}

export function handleDisconnectSAFESaviour(event: DisconnectSAFESaviour): void {
  let saviour = SafeSaviour.load(event.params.saviour.toHexString())
  if (!saviour) {
    log.error('Try to load non existing saviour', [])
  } else {
    saviour.allowed = false
    saviour.save()
  }
}

export function handleProtectSAFE(event: ProtectSAFE): void {
  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  let safe = Safe.load(event.params.safe.toHexString() + '-' + collateral.id)

  if (!safe) {
    log.error('Try to add saviour to non existing safe', [])
  } else {
    safe.saviour = event.params.saviour.toHexString()
    safe.save()
  }
}
