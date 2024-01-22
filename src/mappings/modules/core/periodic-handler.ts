import { ethereum } from '@graphprotocol/graph-ts'
import { DailyStat, getSystemState, HourlyStat } from '../../../entities'
import { EACAggregatorProxy } from '../../../../generated/SAFEEngine/EACAggregatorProxy'
import * as integer from '../../../utils/integer'
import * as decimal from '../../../utils/decimal'
import { getUniEthPrice } from '../uniswap/uniswapv3'

import { addressMap } from '../../../utils/addresses'

const CHAINLINK_ETHUSD_PRECISION = 1e8

// !! When using this function you need to add the Uniswap pair ABI
// in the subgraph template of the indexing contract
export function periodicHandler(event: ethereum.Event): void {
  let timestamp = event.block.timestamp
  let dailyId = timestamp.div(integer.fromNumber(86400)).toString()
  let hourlyId = timestamp.div(integer.fromNumber(3600)).toString()
  let daily = DailyStat.load(dailyId)
  let hourly = HourlyStat.load(hourlyId)

  if (daily !== null && hourly !== null) {
    // The daily and hourly update already exist
    return
  }

  let state = getSystemState(event)
  state.lastPeriodicUpdate = timestamp
  state.save()

  if (!state.currentRedemptionRate || !state.currentRedemptionPrice) {
    // We're missing data, maybe the system is starting
    return
  }

  let ethPrice = EACAggregatorProxy.bind(addressMap.get('CHAINLINK_AGGREGATOR'))
    .latestAnswer()
    .toBigDecimal()
    .div(decimal.fromNumber(CHAINLINK_ETHUSD_PRECISION))

  if (daily == null) {
    // Daily record
    daily = new DailyStat(dailyId)
    daily.timestamp = timestamp
    daily.blockNumber = event.block.number
    daily.redemptionRate = state.currentRedemptionRate
    daily.redemptionPrice = state.currentRedemptionPrice
    let haiEthPrice = getUniEthPrice(event)
    if (haiEthPrice == decimal.ZERO) {
      daily.marketPriceEth = decimal.ZERO
      daily.marketPriceUsd = decimal.ZERO
    } else {
      daily.marketPriceEth = haiEthPrice
      daily.marketPriceUsd = ethPrice.times(haiEthPrice)
    }
    daily.globalDebt = state.globalDebt
    daily.erc20CoinTotalSupply = state.erc20CoinTotalSupply
    daily.save()
  } else if (hourly == null) {
    // Hourly record
    hourly = new HourlyStat(hourlyId)
    hourly.timestamp = timestamp
    hourly.blockNumber = event.block.number
    hourly.redemptionRate = state.currentRedemptionRate
    hourly.redemptionPrice = state.currentRedemptionPrice
    let haiEthPrice = getUniEthPrice(event)
    if (haiEthPrice == decimal.ZERO) {
      hourly.marketPriceEth = decimal.ZERO
      hourly.marketPriceUsd = decimal.ZERO
    } else {
      hourly.marketPriceEth = haiEthPrice
      hourly.marketPriceUsd = ethPrice.times(haiEthPrice)
    }
    hourly.globalDebt = state.globalDebt
    hourly.erc20CoinTotalSupply = state.erc20CoinTotalSupply
    hourly.save()

    // Update Global debt from 24h ago for TVL 24h % change
    // Get the hourly record from 24 ago
    let time = timestamp
      .minus(integer.fromNumber(24 * 3600))
      .div(integer.fromNumber(3600))
      .toString()
    let record = HourlyStat.load(time)
    if (record != null) {
      state.globalDebt24hAgo = record.globalDebt
      state.save()
    }
  }
}
