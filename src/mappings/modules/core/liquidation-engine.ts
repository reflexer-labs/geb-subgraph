import {
  ModifyParameters1 as ModifyParametersCollateralTypeUint,
  ModifyParameters2 as ModifyParametersCollateralTypeAddress,
  Liquidate,
} from '../../../../generated/LiquidationEngine/LiquidationEngine'

import { EnglishCollateralAuctionHouse } from '../../../../generated/templates'
import { EnglishCollateralAuctionHouse as EnglishCollateralAuctionHouseBind } from '../../../../generated/templates/EnglishCollateralAuctionHouse/EnglishCollateralAuctionHouse'
import { getOrCreateCollateral, CollateralAuction, Cdp, EnglishAuctionConfiguration } from '../../../entities'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

import { updateLastModifyCollateralType } from '../../../utils/state'
import { log } from '@graphprotocol/graph-ts'

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
      auctionConfiguration.save()

      collateral.auctionType = 'ENGLISH'
      collateral.totalAuctionLength = integer.DAY.times(integer.fromNumber(2)) // 2 days
      collateral.englishAuctionConfiguration = auctionConfiguration.id

      // Start indexing an instance of english auction contract
      EnglishCollateralAuctionHouse.create(address)
      log.info('Start indexing english auction house: {}', [address.toHexString()])
    } else if (auctionType == 'FIXED_DISCOUNT') {
      log.warning('Fixed discount auctions not implemented! (collateral: {})', [collateral.id])
      collateral.auctionType = 'FIXED_DISCOUNT'
      // TODO: Fix discount auctions
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

  log.info('Start liquidation id {} of collateral {}', [id.toString(), collateral.id])

  let liquidation = new CollateralAuction(collateral.id.toString() + '-' + id.toString())
  liquidation.auctionId = id
  liquidation.auctionType = collateral.auctionType
  liquidation.collateralType = collateral.id
  liquidation.cdpHandler = event.params.cdp
  liquidation.collateralAmount = decimal.fromWad(event.params.collateralAmount)
  liquidation.debtAmount = decimal.fromWad(event.params.debtAmount)
  liquidation.amountToRaise = decimal.fromRad(event.params.amountToRaise)
  liquidation.startedBy = event.transaction.from
  liquidation.isTerminated = false
  liquidation.isClaimed = false
  liquidation.createdAt = event.block.timestamp
  liquidation.createdAtBlock = event.block.number
  liquidation.createdAtTransaction = event.transaction.hash
  if (liquidation.auctionType == 'ENGLISH') {
    liquidation.englishAuctionConfiguration = collateral.id
  } else if (liquidation.auctionType == 'FIX_DISCOUNT') {
    liquidation.fixDiscountAuctionConfiguration = collateral.id
  }

  let cdp = Cdp.load(event.params.cdp.toHexString() + '-' + collateral.id)
  liquidation.cdp = cdp.id

  liquidation.auctionDeadline = collateral.totalAuctionLength.plus(event.block.timestamp)

  liquidation.save()
}
