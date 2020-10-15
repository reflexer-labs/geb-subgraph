import { ethereum } from '@graphprotocol/graph-ts'
import { DailyStat, HourlyStat, SystemState } from '../../../entities'
import * as integer from '../../../utils/integer'

export function blockHandler(block: ethereum.Block): void {
  let timestamp = block.timestamp
  let dailyId = timestamp.div(integer.fromNumber(86400)).toString()
  let hourlyId = timestamp.div(integer.fromNumber(3600)).toString()
  let daily = DailyStat.load(dailyId)
  let hourly = HourlyStat.load(hourlyId)

  if (hourly == null || daily == null) {
    let state = SystemState.load('current')
    if (state == null) {
      return
    }

    if (daily == null) {
      daily = new DailyStat(dailyId)
      daily.timestamp = timestamp
      daily.blockNumber = block.number
      daily.redemptionRate = state.currentRedemptionRate
      daily.redemptionPrice = state.currentRedemptionPrice
      daily.globalDebt = state.globalDebt
      daily.erc20CoinTotalSupply = state.erc20CoinTotalSupply
      daily.save()
    } else if (hourly == null) {
      hourly = new HourlyStat(dailyId)
      hourly.timestamp = timestamp
      hourly.blockNumber = block.number
      hourly.redemptionRate = state.currentRedemptionRate
      hourly.redemptionPrice = state.currentRedemptionPrice
      hourly.globalDebt = state.globalDebt
      hourly.erc20CoinTotalSupply = state.erc20CoinTotalSupply
      hourly.save()
    }
  }
}
