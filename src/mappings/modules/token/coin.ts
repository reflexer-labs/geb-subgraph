import { Address, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import {
  Transfer,
  Approval,
  Coin,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/Coin/Coin'
import { ERC20Allowance, ERC20Balance, ERC20Transfer, getSystemState } from '../../../entities'
import {
  getOrCreateERC20Balance,
  getOrCreateERC20BAllowance,
  updateAllowance,
} from '../../../entities/erc20'
import * as decimal from '../../../utils/decimal'
import { eventUid } from '../../../utils/ethereum'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

const COIN_LABEL = 'COIN'

export function handleTransfer(event: Transfer): void {
  let tokenAddress = dataSource.address()

  let source = event.params.src
  let destination = event.params.dst
  let amount = decimal.fromWad(event.params.amount)
  let nullAddress = Address.fromHexString('0x0000000000000000000000000000000000000000')
  let system = getSystemState(event)

  // Check if it's not a burn before updating destination
  if (!destination.equals(nullAddress)) {
    let destBalance = getOrCreateERC20Balance(destination, tokenAddress, COIN_LABEL, event, true)
    destBalance.balance = destBalance.balance.plus(amount)
    destBalance.modifiedAt = event.block.timestamp
    destBalance.modifiedAtBlock = event.block.number
    destBalance.modifiedAtTransaction = event.transaction.hash
    destBalance.save()
  } else {
    // Burn
    system.erc20CoinTotalSupply = system.erc20CoinTotalSupply.minus(amount)
  }

  // Check if it's not a mint before updating source
  if (!source.equals(nullAddress)) {
    let srcBalance = getOrCreateERC20Balance(source, tokenAddress, COIN_LABEL, event, false)
    srcBalance.balance = srcBalance.balance.minus(amount)
    srcBalance.modifiedAt = event.block.timestamp
    srcBalance.modifiedAtBlock = event.block.number
    srcBalance.modifiedAtTransaction = event.transaction.hash
    srcBalance.save()
  } else {
    // Mint
    system.erc20CoinTotalSupply = system.erc20CoinTotalSupply.plus(amount)
  }

  system.save()

  // Deduct the allowance
  // If this transfer is a transferFrom we need deduct the allowance by the amount of the transfer.
  // Updating the allowance is highly problematic because we don't have access to msg.sender who is
  // the allowed address. We sync the allowance assuming msg.sender is the destination (a contract pulling
  // funds) but it might not always be the case and therefore the allowance will be wrong. But it should work
  // in most cases.

  updateAllowance(tokenAddress, destination, source, COIN_LABEL, event)

  // Sync these assuming msg.sender is the contract emitting the event or tx originator
  updateAllowance(tokenAddress, event.address, source, COIN_LABEL, event)
  updateAllowance(tokenAddress, event.transaction.from, source, COIN_LABEL, event)

  // Create a transfer object
  let transfer = new ERC20Transfer(eventUid(event))
  transfer.tokenAddress = tokenAddress
  transfer.label = COIN_LABEL
  transfer.source = source
  transfer.destination = destination
  transfer.amount = amount
  transfer.createdAt = event.block.timestamp
  transfer.createdAtBlock = event.block.number
  transfer.createdAtTransaction = event.transaction.hash
  transfer.save()
}

export function handleApproval(event: Approval): void {
  let tokenAddress = dataSource.address()
  let allowance = getOrCreateERC20BAllowance(
    event.params.src,
    tokenAddress,
    event.params.guy,
    COIN_LABEL,
    event,
  )
  allowance.amount = decimal.fromWad(event.params.amount)
  allowance.modifiedAt = event.block.timestamp
  allowance.modifiedAtBlock = event.block.number
  allowance.modifiedAtTransaction = event.transaction.hash
  allowance.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
