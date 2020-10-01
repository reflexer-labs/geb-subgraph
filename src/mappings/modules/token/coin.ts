import { Address, dataSource, log } from '@graphprotocol/graph-ts'
import { Transfer, Approval, Coin } from '../../../../generated/Coin/Coin'
import { ERC20Allowance, ERC20Balance, ERC20Transfer } from '../../../entities'
import { getOrCreateERC20Balance, getOrCreateERC20BAllowance } from '../../../entities/erc20'
import * as decimal from '../../../utils/decimal'
import { eventUid } from '../../../utils/ethereum'

export function handleTransfer(event: Transfer): void {
  let tokenAddress = dataSource.address()

  let source = event.params.src
  let destination = event.params.dst
  let amount = decimal.fromWad(event.params.amount)
  let nullAddress = Address.fromHexString('0x0000000000000000000000000000000000000000')
  // Check if it's not a burn before updating destination
  if (!destination.equals(nullAddress)) {
    let destBalance = getOrCreateERC20Balance(destination, tokenAddress, event)
    destBalance.balance = destBalance.balance.plus(amount)
    destBalance.modifiedAt = event.block.timestamp
    destBalance.modifiedAtBlock = event.block.number
    destBalance.modifiedAtTransaction = event.transaction.hash
    destBalance.save()
  }

  // Check if it's not a mint before updating source
  if (!source.equals(nullAddress)) {
    let srcBalance = getOrCreateERC20Balance(source, tokenAddress, event, false)
    srcBalance.balance = srcBalance.balance.minus(amount)
    srcBalance.modifiedAt = event.block.timestamp
    srcBalance.modifiedAtBlock = event.block.number
    srcBalance.modifiedAtTransaction = event.transaction.hash
    srcBalance.save()
  }

  // Check if it's a transferFrom
  log.error('ERRR {} {} {} {} {} {}', [
    source.toHexString(),
    destination.toHexString(),
    event.transaction.hash.toHexString(),
    event.transaction.from.toHexString(),
    event.address.toHexString(),
    amount.toString(),
  ])

  // TODO: Deduct allowance when it's a transferFrom call. (Not possible )
  // Hacky way to figure out if it's a transferFrom or a simple transfer
  // First make sure it's not a burn or mint
  // if (!source.equals(nullAddress) && !destination.equals(nullAddress)) {
  //   let contract = Coin.bind(dataSource.address())
  //   let srcBalance = getOrCreateERC20Balance(source, tokenAddress, event, false)
  //   let msgDotSender: Address

  // Loop over all the approvals of the source address
  // for (let i = 0; i < srcBalance.approvals.length; i++) {

  //     if(!srcBalance.approvals[0]) {
  //         log.error("s",[])
  //     }
  //   let approval = ERC20Allowance.load(id)

  //   // If this is not matching, it means that it's a transfer from
  //   if (approval.amount.equals(decimal.fromWad(contract.allowance(source, approval.approvedAddress)))) {
  //     msgDotSender = approval.approvedAddress
  //   }
  // }

  // if (msgDotSender) {
  //   // It was a transfer from, so deduct the allowance
  //   let allowance = getOrCreateERC20BAllowance(source, tokenAddress, msgDotSender, event, false)
  //   allowance.amount = allowance.amount.minus(decimal.fromWad(event.params.amount))
  //   allowance.modifiedAt = event.block.timestamp
  //   allowance.modifiedAtBlock = event.block.number
  //   allowance.modifiedAtTransaction = event.transaction.hash
  //   allowance.save()
  // }
  // }

  let transfer = new ERC20Transfer(eventUid(event))
  transfer.tokenAddress = tokenAddress
  transfer.source = source
  transfer.destination = destination
  transfer.createdAt = event.block.timestamp
  transfer.createdAtBlock = event.block.number
  transfer.createdAtTransaction = event.transaction.hash
  transfer.save()
}

export function handleApproval(event: Approval): void {
  let tokenAddress = dataSource.address()
  let allowance = getOrCreateERC20BAllowance(event.params.src, tokenAddress, event.params.guy, event)
  allowance.amount = decimal.fromWad(event.params.amount)
  allowance.modifiedAt = event.block.timestamp
  allowance.modifiedAtBlock = event.block.number
  allowance.modifiedAtTransaction = event.transaction.hash
  allowance.save()
}
