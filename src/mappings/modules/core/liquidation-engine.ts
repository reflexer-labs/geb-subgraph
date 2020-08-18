import {
  ModifyParameters1 as ModifyParametersCollateralTypeUint,
  ModifyParameters2 as ModifyParametersCollateralTypeAddress,
  Liquidate,
} from '../../../../generated/LiquidationEngine/LiquidationEngine'

import { EnglishCollateralAuctionHouse, FixDiscountCollateralAuction } from '../../../../generated/templates'
import { EnglishCollateralAuctionHouse as EnglishCollateralAuctionHouseBind } from '../../../../generated/templates/EnglishCollateralAuctionHouse/EnglishCollateralAuctionHouse'
import {
  getOrCreateCollateral,
  Cdp,
  EnglishAuctionConfiguration,
  EnglishCollateralAuction,
  FixDiscountAuctionConfiguration,
} from '../../../entities'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

import { log } from '@graphprotocol/graph-ts'
import { updateLastModifyCollateralType } from '../../../entities/collateral'

export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  if (what == 'liquidationPenalty') {
    collateral.liquidationPenalty = decimal.fromRay(event.params.data)
  } else if (what == 'collateralToSell') {
    collateral.maxCollateralToSellInLiquidations = decimal.fromWad(event.params.data)
  }

  updateLastModifyCollateralType(collateral, event)
  collateral.save()
}

export function handleModifyParametersCollateralTypeAddress(event: ModifyParametersCollateralTypeAddress): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  if (what == 'collateralAuctionHouse') {
    // Configure auction type

    let address = event.params.data
    collateral.collateralAuctionHouseAddress = address

    // Detect the type of auction
    let auctionHouse = EnglishCollateralAuctionHouseBind.bind(address)
    let auctionType = auctionHouse.AUCTION_TYPE().toString()

    if (auctionType == 'ENGLISH') {
      log.info('English auction set for collateral {}', [collateral.id])

      // Default auction config
      let auctionConfiguration = new EnglishAuctionConfiguration(collateral.id)
      auctionConfiguration.bidIncrease = decimal.fromNumber(1.05)
      auctionConfiguration.bidDuration = integer.HOUR.times(integer.fromNumber(3)) // 3 hours
      auctionConfiguration.bidToMarketPriceRatio = decimal.ZERO
      auctionConfiguration.collateralType = collateral.id
      auctionConfiguration.totalAuctionLength = integer.DAY.times(integer.fromNumber(2)) // 2 days
      auctionConfiguration.save()

      collateral.auctionType = 'ENGLISH'
      collateral.englishAuctionConfiguration = auctionConfiguration.id

      // Start indexing an instance of english auction contract
      EnglishCollateralAuctionHouse.create(address)
      log.info('Start indexing english auction house: {}', [address.toHexString()])
    } else if (auctionType == 'FIXED_DISCOUNT') {
      // Default auction config
      let auctionConfiguration = new FixDiscountAuctionConfiguration(collateral.id)
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

      collateral.auctionType = 'FIXED_DISCOUNT'
      collateral.fixDiscountAuctionConfiguration = auctionConfiguration.id

      // Start indexing an instance of fix discount auction contract
      FixDiscountCollateralAuction.create(address)
      log.info('Start indexing fix discount auction house: {}', [address.toHexString()])
    } else {
      log.error('Unknown auction type: {} ', [auctionType as string])
    }
  }

  updateLastModifyCollateralType(collateral, event)
  collateral.save()
}

export function handleLiquidate(event: Liquidate): void {
  let id = event.params.auctionId
  let collateral = getOrCreateCollateral(event.params.collateralType, event)
  let config = EnglishAuctionConfiguration.load(collateral.id)
  log.info('Start liquidation id {} of collateral {}', [id.toString(), collateral.id])

  if (collateral.auctionType == 'ENGLISH') {
    let liquidation = new EnglishCollateralAuction(collateral.id.toString() + '-' + id.toString())

    // TODO: I CHANGED THE ID, THIS IS WRONG! + ADDED BID COUNTER!!
    liquidation.auctionId = id
    liquidation.auctionType = collateral.auctionType
    liquidation.collateralType = collateral.id
    liquidation.cdpHandler = event.params.cdp
    liquidation.initialCollateralAmount = decimal.fromWad(event.params.collateralAmount)
    liquidation.initialDebtAmount = decimal.fromWad(event.params.debtAmount)
    liquidation.bondAmountRaised = decimal.ZERO
    liquidation.collateralAmountSold = liquidation.initialCollateralAmount
    liquidation.highestBidPrice = decimal.ZERO
    liquidation.bondAmountToRaise = decimal.fromRad(event.params.amountToRaise)
    liquidation.startedBy = event.transaction.from
    liquidation.isClaimed = false
    liquidation.createdAt = event.block.timestamp
    liquidation.createdAtBlock = event.block.number
    liquidation.createdAtTransaction = event.transaction.hash
    liquidation.englishAuctionConfiguration = collateral.id
    liquidation.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

    let cdp = Cdp.load(event.params.cdp.toHexString() + '-' + collateral.id)
    liquidation.cdp = cdp.id

    liquidation.save()
  } else if (collateral.auctionType == 'FIX_DISCOUNT') {
    // TODO:
  }
}
