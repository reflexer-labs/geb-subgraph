import { ethereum } from '@graphprotocol/graph-ts'
import { DailyStat, getSystemState, HourlyStat } from '../../../entities'
import * as integer from '../../../utils/integer'

export function periodicHandler(event: ethereum.Event): void {
  let timestamp = event.block.timestamp
  let dailyId = timestamp.div(integer.fromNumber(86400)).toString()
  let hourlyId = timestamp.div(integer.fromNumber(3600)).toString()
  let daily = DailyStat.load(dailyId)
  let hourly = HourlyStat.load(hourlyId)

  let state = getSystemState(event)

  state.lastPeriodicUpdate = timestamp
  state.save()

  if (daily == null) {
    daily = new DailyStat(dailyId)
    daily.timestamp = timestamp
    daily.blockNumber = event.block.number
    daily.redemptionRate = state.currentRedemptionRate
    daily.redemptionPrice = state.currentRedemptionPrice
    daily.globalDebt = state.globalDebt
    daily.erc20CoinTotalSupply = state.erc20CoinTotalSupply
    daily.save()
  } else if (hourly == null) {
    hourly = new HourlyStat(hourlyId)
    hourly.timestamp = timestamp
    hourly.blockNumber = event.block.number
    hourly.redemptionRate = state.currentRedemptionRate
    hourly.redemptionPrice = state.currentRedemptionPrice
    hourly.globalDebt = state.globalDebt
    hourly.erc20CoinTotalSupply = state.erc20CoinTotalSupply
    hourly.save()
  }
}
