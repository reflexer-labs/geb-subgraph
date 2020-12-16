import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  DelayedRewardPaid,
  DelayReward,
  GebUniswapRollingDistributionIncentives,
  RewardPaid,
  CampaignAdded,
  Staked,
  Withdrawn,
} from '../../../../generated/UniswapRollingDistributionIncentives/GebUniswapRollingDistributionIncentives'

import { Address, ethereum, log, BigInt } from '@graphprotocol/graph-ts'
import { getOrCreateERC20Balance } from '../../../entities/erc20'
import { IncentiveBalance, IncentiveCampaign, UserProxy } from '../../../../generated/schema'

const INCENTIVE_STAKE_LABEL = 'INCENTIVE_STAKE'
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

// This function replicates the updateReward reward modifier of the incentive contract
function updateAccountStake(account: Address, event: ethereum.Event): void {
  let contract = GebUniswapRollingDistributionIncentives.bind(event.address)
  let firstCampaign = contract.firstCampaign().toI32()
  let lastCampaignBigInt = contract.campaignCount()
  let lastCampaign = lastCampaignBigInt.toI32()

  // ERC20 representation of the staked UNI token
  let stakedBal = getOrCreateERC20Balance(
    account,
    event.address,
    event,
    true,
    INCENTIVE_STAKE_LABEL,
  )
  stakedBal.balance = decimal.fromWad(contract.balanceOf(account))
  stakedBal.save()

  for (let i = lastCampaign; i >= firstCampaign; i--) {
    // -- Incentive Campaign Update --

    // Load campaign parameters
    let campaign = IncentiveCampaign.load(i.toString())
    if (!campaign) {
      log.error('Try to update non existing campaign id {}', [i.toString()])
    }

    let campaignId = integer.fromNumber(i)
    let campaignObj = contract.campaigns(campaignId)

    if (campaign.lastUpdatedTime.notEqual(campaignObj.value4)) {
      campaign.totalSupply = decimal.fromWad(contract.totalSupply())
      campaign.rewardPerTokenStored = decimal.fromWad(campaignObj.value5)
      campaign.lastUpdatedTime = campaignObj.value4
      campaign.modifiedAt = event.block.timestamp
      campaign.modifiedAtBlock = event.block.number
      campaign.modifiedAtTransaction = event.transaction.hash
      campaign.save()
    }

    // -- Incentive balance update --

    let userRewardPerTokenPaid = decimal.fromWad(
      contract.userRewardPerTokenPaid(account, campaignId),
    )
    if (userRewardPerTokenPaid.equals(decimal.ZERO) && campaignId.lt(lastCampaignBigInt)) {
      break
    }

    let bal = getOrCreateIncentiveBalance(account, campaignId, event)

    // Update stake vars
    bal.stakedBalance = stakedBal.balance
    bal.reward = decimal.fromWad(contract.rewards(account, campaignId))
    bal.userRewardPerTokenPaid = userRewardPerTokenPaid

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
  }
}

function getOrCreateIncentiveBalance(
  account: Address,
  campaignId: BigInt,
  event: ethereum.Event,
): IncentiveBalance {
  let entityId = account.toHexString() + '-' + campaignId.toString()
  let bal = IncentiveBalance.load(entityId)

  if (!bal) {
    bal = new IncentiveBalance(entityId)
    bal.address = account
    bal.campaignId = campaignId

    // If the account is a proxy, set the proxy owner as owner.
    let proxy = UserProxy.load(account.toHexString())
    bal.owner = proxy ? proxy.owner.toString() : null
    bal.stakedBalance = decimal.ZERO
    bal.reward = decimal.ZERO
    bal.userRewardPerTokenPaid = decimal.ZERO
    bal.delayedRewardExitedAmount = decimal.ZERO
    bal.delayedRewardTotalAmount = decimal.ZERO
    bal.delayedRewardLatestExitTime = integer.ZERO
    bal.createdAtBlock = event.block.number
    bal.createdAt = event.block.timestamp
    bal.createdAtTransaction = event.transaction.hash
    bal.save()
  }

  return bal as IncentiveBalance
}
