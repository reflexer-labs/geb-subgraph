import { Address, Bytes, dataSource, log } from '@graphprotocol/graph-ts'
import { Approval, Burn, Mint, Transfer } from '../../../../generated/ProtToken/DSToken'
import { ERC20Transfer } from '../../../../generated/schema'
import {
  getOrCreateERC20Balance,
  getOrCreateERC20BAllowance,
  updateAllowance,
} from '../../../entities/erc20'

import * as decimal from '../../../utils/decimal'
import { eventUid, NULL_ADDRESS } from '../../../utils/ethereum'

const PROT_TOKEN_LABEL = 'PROT_TOKEN'
export function handleTransfer(event: Transfer): void {
  let tokenAddress = dataSource.address()

  let source = event.params.src
  let destination = event.params.dst
  let amount = decimal.fromWad(event.params.wad)
  let nullAddress = Address.fromHexString('0x0000000000000000000000000000000000000000')

  // Check if it's not a burn before updating destination
  if (!destination.equals(nullAddress)) {
    let destBalance = getOrCreateERC20Balance(
      destination,
      tokenAddress,
      PROT_TOKEN_LABEL,
      event,
      true,
    )
    destBalance.balance = destBalance.balance.plus(amount)
    destBalance.modifiedAt = event.block.timestamp
    destBalance.modifiedAtBlock = event.block.number
    destBalance.modifiedAtTransaction = event.transaction.hash
    destBalance.save()
  }

  // Check if it's not a mint before updating source
  if (!source.equals(nullAddress)) {
    let srcBalance = getOrCreateERC20Balance(source, tokenAddress, PROT_TOKEN_LABEL, event, true)
    srcBalance.balance = srcBalance.balance.minus(amount)
    srcBalance.modifiedAt = event.block.timestamp
    srcBalance.modifiedAtBlock = event.block.number
    srcBalance.modifiedAtTransaction = event.transaction.hash
    srcBalance.save()
  }

  // Deduct the allowance
  // If this transfer is a transferFrom we need deduct the allowance by the amount of the transfer.
  // Updating the allowance is highly problematic because we don't have access to msg.sender who is
  // the allowed address. We sync the allowance assuming msg.sender is the destination (a contract pulling
  // funds) but it might not always be the case and therefore the allowance will be wrong. But it should work
  // in most cases.

  updateAllowance(tokenAddress, destination, source, PROT_TOKEN_LABEL, event)

  // Sync these assuming msg.sender is the contract emitting the event or tx originator
  updateAllowance(tokenAddress, event.address, source, PROT_TOKEN_LABEL, event)

  updateAllowance(tokenAddress, event.transaction.from, source, PROT_TOKEN_LABEL, event)

  // Create a transfer object
  let transfer = new ERC20Transfer(eventUid(event))
  transfer.tokenAddress = tokenAddress
  transfer.label = PROT_TOKEN_LABEL
  transfer.source = source
  transfer.destination = destination
  transfer.amount = amount
  transfer.createdAt = event.block.timestamp
  transfer.createdAtBlock = event.block.number
  transfer.createdAtTransaction = event.transaction.hash
  transfer.save()
}

export function handleMint(event: Mint): void {
  let bal = getOrCreateERC20Balance(
    event.params.guy,
    dataSource.address(),
    PROT_TOKEN_LABEL,
    event,
    true,
  )
  let amount = decimal.fromWad(event.params.wad)
  bal.balance = bal.balance.plus(amount)
  bal.save()

  // Create a transfer object from the NULL address
  let transfer = new ERC20Transfer(eventUid(event))
  transfer.tokenAddress = dataSource.address()
  transfer.label = PROT_TOKEN_LABEL
  transfer.source = NULL_ADDRESS as Bytes
  transfer.destination = event.params.guy
  transfer.amount = amount
  transfer.createdAt = event.block.timestamp
  transfer.createdAtBlock = event.block.number
  transfer.createdAtTransaction = event.transaction.hash
  transfer.save()
}

export function handleBurn(event: Burn): void {
  let tokenAddress = dataSource.address()
  let bal = getOrCreateERC20Balance(event.params.guy, tokenAddress, PROT_TOKEN_LABEL, event, true)

  // Sync these assuming msg.sender is the contract emitting the event or tx originator
  updateAllowance(tokenAddress, event.transaction.from, event.params.guy, PROT_TOKEN_LABEL, event)

  let amount = decimal.fromWad(event.params.wad)
  bal.balance = bal.balance.minus(amount)
  bal.save()

  // Create a transfer object to the NULL address
  let transfer = new ERC20Transfer(eventUid(event))
  transfer.tokenAddress = tokenAddress
  transfer.label = PROT_TOKEN_LABEL
  transfer.source = event.params.guy
  transfer.destination = NULL_ADDRESS as Bytes
  transfer.amount = amount
  transfer.createdAt = event.block.timestamp
  transfer.createdAtBlock = event.block.number
  transfer.createdAtTransaction = event.transaction.hash
  transfer.save()
}

export function handleApproval(event: Approval): void {
  let tokenAddress = event.address
  let allowance = getOrCreateERC20BAllowance(
    event.params.src,
    tokenAddress,
    event.params.guy,
    PROT_TOKEN_LABEL,
    event,
  )
  allowance.amount = decimal.fromWad(event.params.wad)
  allowance.modifiedAt = event.block.timestamp
  allowance.modifiedAtBlock = event.block.number
  allowance.modifiedAtTransaction = event.transaction.hash
  allowance.save()
}
