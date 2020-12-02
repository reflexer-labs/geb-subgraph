import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  DelayedRewardPaid,
  DelayReward,
  GebUniswapRollingDistributionIncentives,
  RewardPaid,
} from '../../../../generated/UniswapRollingDistributionIncentives/GebUniswapRollingDistributionIncentives'
import {
  CampaignAdded,
  Staked,
  Withdrawn,
} from '../../../../generated/UniswapRollingDistributionIncentives/GebUniswapRollingDistributionIncentives'
import { IncentiveBalance, IncentiveCampaign, UserProxy } from '../../../entities'
import { Address, ethereum, log } from '@graphprotocol/graph-ts'

export function handleCampaignAdded(event: CampaignAdded): void {
  let contract = GebUniswapRollingDistributionIncentives.bind(event.address)
  let campaign = new IncentiveCampaign(event.params.campaignId.toString())

  let campaignObj = contract.campaigns(event.params.campaignId)

  campaign.startTime = campaignObj.value1
  campaign.duration = campaignObj.value2
  campaign.rewardDelay = campaignObj.value6
  // Uint between 0 and 1000
  campaign.instantExitPercentage = campaignObj.value7.toBigDecimal().div(decimal.fromNumber(1000))
  campaign.reward = decimal.fromWad(campaignObj.value0)
  campaign.rewardRate = decimal.fromWad(campaignObj.value3)
  campaign.lastUpdatedTime = campaignObj.value4
  campaign.rewardPerTokenStored = decimal.fromWad(campaignObj.value5)
  campaign.createdAtBlock = event.block.number
  campaign.createdAt = event.block.timestamp
  campaign.createdAtTransaction = event.transaction.hash
  campaign.totalSupply = decimal.ZERO
  campaign.save()
}

export function handleStaked(event: Staked): void {
  updateAccountStake(event.params.user, event)
}

export function handleWithdrawn(event: Withdrawn): void {
  updateAccountStake(event.params.user, event)
}

export function handleRewardPaid(event: RewardPaid): void {
  updateAccountStake(event.params.user, event)
}

export function handleDelayReward(event: DelayReward): void {
  updateAccountStake(event.params.account, event)
}

export function handleDelayedRewardPaid(event: DelayedRewardPaid): void {
  updateAccountStake(event.params.user, event)
}

function updateAccountStake(account: Address, event: ethereum.Event): void {
  let contract = GebUniswapRollingDistributionIncentives.bind(event.address)
  let firstCampaign = contract.firstCampaign().toI32()
  let lastCampaign = contract.campaignCount().toI32()
  for (let i = firstCampaign; i < lastCampaign + 1; i++) {
    let campaign = IncentiveCampaign.load(i.toString())
    let bal = IncentiveBalance.load(account.toHexString() + '-' + i.toString())
    let campaignId = integer.fromNumber(i)
    if (!campaign) {
      log.error('Try to update non existing campaign id {}', [i.toString()])
    }

    // Update user specific vars
    if (!bal) {
      // Create ball
      bal = new IncentiveBalance(account.toHexString() + '-' + i.toString())
      bal.address = account
      bal.campaignId = campaignId

      // If the account is a proxy, set the proxy owner as owner.
      let proxy = UserProxy.load(account.toHexString())
      bal.owner = proxy ? proxy.owner.toString() : null
      bal.createdAtBlock = event.block.number
      bal.createdAt = event.block.timestamp
      bal.createdAtTransaction = event.transaction.hash
    }

    // Update stake vars
    bal.stakedBalance = decimal.fromWad(contract.balanceOf(account))
    bal.reward = decimal.fromWad(contract.rewards(account, campaignId))
    bal.userRewardPerTokenPaid = decimal.fromWad(
      contract.userRewardPerTokenPaid(account, campaignId),
    )

    // Update vesting vars
    let vestingVars = contract.delayedRewards(account, campaignId)
    bal.delayedRewardTotalAmount = decimal.fromWad(vestingVars.value0)
    bal.delayedRewardExitedAmount = decimal.fromWad(vestingVars.value1)
    bal.delayedRewardLatestExitTime = vestingVars.value2

    // Update modify vars
    bal.modifiedAt = event.block.timestamp
    bal.modifiedAtBlock = event.block.number
    bal.modifiedAtTransaction = event.transaction.hash
    bal.save()

    // Update system wide vars
    let campaignObj = contract.campaigns(campaignId)
    campaign.totalSupply = decimal.fromWad(contract.totalSupply())
    campaign.rewardPerTokenStored = decimal.fromWad(campaignObj.value5)
    campaign.lastUpdatedTime = campaignObj.value4
    campaign.modifiedAt = event.block.timestamp
    campaign.modifiedAtBlock = event.block.number
    campaign.modifiedAtTransaction = event.transaction.hash
    campaign.save()
  }
}
