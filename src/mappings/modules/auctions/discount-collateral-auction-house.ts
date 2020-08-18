import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  FixedDiscountCollateralAuctionHouse,
} from '../../../../generated/templates/FixDiscountCollateralAuction/FixedDiscountCollateralAuctionHouse'
import { dataSource } from '@graphprotocol/graph-ts'
import { getOrCreateCollateral, FixDiscountAuctionConfiguration } from '../../../entities'

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    FixedDiscountCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = FixDiscountAuctionConfiguration.load(collateral.id)
  let val = event.params.data

  if (what == 'discount') {
    config.discount = decimal.fromWad(val)
  } else if (what == 'lowerCollateralMedianDeviation') {
    config.lowerCollateralMedianDeviation = decimal.fromWad(val)
  } else if (what == 'upperCollateralMedianDeviation') {
    config.upperCollateralMedianDeviation = decimal.fromWad(val)
  } else if (what == 'lowerSystemCoinMedianDeviation') {
    config.lowerSystemCoinMedianDeviation = decimal.fromWad(val)
  } else if (what == 'upperSystemCoinMedianDeviation') {
    config.upperSystemCoinMedianDeviation = decimal.fromWad(val)
  } else if (what == 'minSystemCoinMedianDeviation') {
    config.minSystemCoinMedianDeviation = decimal.fromWad(val)
  } else if (what == 'minimumBid') {
    config.minimumBid = decimal.fromWad(val)
  } else if (what == 'totalAuctionLength') {
    config.totalAuctionLength = val
  }

  config.save()
}

export function handleModifyParametersAddress(event: ModifyParametersAddress): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    FixedDiscountCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = FixDiscountAuctionConfiguration.load(collateral.id)
  let address = event.params.data

  if (what == 'oracleRelayer') {
    config.oracleRelayer = address
  } else if (what == 'collateralOSM') {
    config.collateralOSM = address
  } else if (what == 'collateralMedian') {
    config.collateralMedian = address
  } else if (what == 'systemCoinOracle') {
    config.systemCoinOracle = address
  }

  config.save()
}
