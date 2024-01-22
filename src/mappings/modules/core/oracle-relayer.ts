import { log, dataSource, BigInt, Address } from '@graphprotocol/graph-ts'

import * as bytes from '../../../utils/bytes'
import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

import {
  InitializeCollateralType,
  UpdateCollateralPrice,
  UpdateRedemptionPrice,
  ModifyParameters as ModifyParameters,
  OracleRelayer,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/OracleRelayer/OracleRelayer'

import { RateSetter } from '../../../../generated/OracleRelayer/RateSetter'

import { OracleRelayer as OracleRelayerBind } from '../../../../generated/OracleRelayer/OracleRelayer'

import {
  CollateralType,
  CollateralPrice,
  RedemptionPrice,
  RedemptionRate,
  CollateralSafe,
  Safe
} from '../../../../generated/schema'
import { getSystemState } from '../../../entities'
import { getOrCreateCollateral } from '../../../entities/collateral'
import { eventUid } from '../../../utils/ethereum'
import { addressMap } from '../../../utils/addresses'
import { SECOND_PER_YEAR } from '../../../utils/integer'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// Register a new collateral type
export function handleInitializeCollateralType(event: InitializeCollateralType): void {
  let collateral = getOrCreateCollateral(event.params._cType, event)
  let oracleContract = OracleRelayerBind.bind(dataSource.address())

  let cParams = oracleContract.cParams(event.params._cType)

  collateral.safetyCRatio = decimal.fromRay(cParams.safetyCRatio)
  collateral.liquidationCRatio = decimal.fromRay(cParams.liquidationCRatio)

  collateral.save()
  log.info('Onboard new collateral Oracle {}', [collateral.id])
}

export function handleUpdateCollateralPrice(event: UpdateCollateralPrice): void {
  let collateralType = event.params._cType.toString()
  let collateralPrice = decimal.fromWad(event.params._priceFeedValue)

  let collateral = CollateralType.load(collateralType)

  if (collateral != null) {
    let liqCRatio = collateral.liquidationCRatio
    let price = new CollateralPrice(eventUid(event))
    price.block = event.block.number
    price.collateral = collateral.id
    price.safetyPrice = decimal.fromRay(event.params._safetyPrice)
    price.liquidationPrice = decimal.fromRay(event.params._liquidationPrice)
    let liqPrice = price.liquidationPrice
    price.timestamp = event.block.timestamp
    price.value = collateralPrice
    price.save()

    collateral.currentPrice = price.id
    collateral.save()

    let collateralSafe = CollateralSafe.load(collateralType)
    if (collateralSafe) {
      let safeIds = collateralSafe.safeIds

      for (let i = 0; i < safeIds.length; i++) {
        let safe = Safe.load(safeIds[i]) 
        if (safe && safe.collateral != decimal.ZERO && safe.debt != decimal.ZERO) {
          let cRatio = safe.collateral.times(liqPrice).times(liqCRatio).div(safe.debt)
        
          safe.cRatio = cRatio

          safe.save()
        }
      }
    }
  }
}

export function handleUpdateRedemptionPrice(event: UpdateRedemptionPrice): void {
  let price = new RedemptionPrice(eventUid(event))
  price.block = event.block.number
  price.timestamp = event.block.timestamp
  price.value = decimal.fromRay(event.params._redemptionPrice)
  let relayer = OracleRelayer.bind(dataSource.address())
  let redemptionRate = relayer.redemptionRate()
  price.redemptionRate = decimal.fromRay(redemptionRate)

  let rate = new RedemptionRate(eventUid(event))

  let perSecondRate = decimal.fromRay(redemptionRate)
  let perSecondRateRay = redemptionRate
  rate.perSecondRate = perSecondRate

  // Calculate solidity annualized rate by calling the contract

  const rpowerRate = (rate: BigInt, nSeconds: i32): decimal.BigDecimal => {
    // Exponentiate in web assembly, it's not exactly like Solidity but more than accurate enough
    return decimal.fromNumber(parseFloat(decimal.fromRay(rate).toString()) ** nSeconds)
  }

  rate.annualizedRate = rpowerRate(perSecondRateRay, 31536000)
  rate.eightHourlyRate = rpowerRate(perSecondRateRay, 3600 * 8)
  rate.twentyFourHourlyRate = rpowerRate(perSecondRateRay, 3600 * 24)
  rate.hourlyRate = rpowerRate(perSecondRateRay, 3600)

  rate.createdAt = event.block.timestamp
  rate.createdAtBlock = event.block.number
  rate.createdAtTransaction = event.transaction.hash

  let system = getSystemState(event)
  system.currentRedemptionPrice = price.id
  system.currentRedemptionRate = rate.id

  system.save()
  price.save()
  rate.save()
}

export function handleModifyParameters(
  event: ModifyParameters,
): void {
  let what = event.params._param.toString()
  let collateralType = CollateralType.load(event.params._cType.toString())

  if (what == 'orcl') {
    let collateral = getOrCreateCollateral(event.params._cType, event)

    collateral.fsmAddress = event.params._data
    collateral.modifiedAt = event.block.timestamp
    collateral.modifiedAtBlock = event.block.number
    collateral.modifiedAtTransaction = event.transaction.hash

    collateral.save()
  } else if (what == 'safetyCRatio') {
    if (collateralType != null) {
      collateralType.safetyCRatio = decimal.fromRay(integer.BigInt.fromUnsignedBytes(event.params._data))
      collateralType.save()
    }
  } else if (what == 'liquidationCRatio') {
    if (collateralType != null) {
      collateralType.liquidationCRatio = decimal.fromRay(integer.BigInt.fromUnsignedBytes(event.params._data))
      collateralType.save()
    }
  } else  if (what == 'redemptionPrice') {
    log.error('ModifyParameters-redemptionPrice is not supported', [])
  }
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params._account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params._account, event)
}
