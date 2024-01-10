import { dataSource } from '@graphprotocol/graph-ts'
import {
  AbandonTransaction,
  AttachTransactionDescription,
  DSProtestPause,
  ExecuteTransaction,
  ProtestAgainstTransaction,
  ScheduleTransaction,
} from '../../../../generated/ProtestPause/DSProtestPause'
import { DsPauseScheduledTransaction } from '../../../entities'

export function handleScheduleTransaction(event: ScheduleTransaction): void {
  let contract = DSProtestPause.bind(dataSource.address())
  let fullHash = contract.getTransactionDataHash1(
    event.params.usr,
    event.params.codeHash,
    event.params.parameters,
    event.params.earliestExecutionTime,
  )
  let proposal = new DsPauseScheduledTransaction(fullHash.toHexString())

  proposal.proposalSender = event.params.sender
  proposal.proposalTarget = event.params.usr
  proposal.executed = false
  proposal.abandoned = false
  proposal.transactionData = event.params.parameters
  proposal.codeHash = event.params.codeHash
  proposal.earliestExecutionTime = event.params.earliestExecutionTime
  proposal.fullTransactionHash = fullHash
  proposal.partialTransactionHash = contract.getTransactionDataHash(
    event.params.usr,
    event.params.codeHash,
    event.params.parameters,
  )
  proposal.createdAt = event.block.timestamp
  proposal.createdAtBlock = event.block.number
  proposal.createdAtTransaction = event.transaction.hash

  proposal.save()
}

export function handleAttachTransactionDescription(event: AttachTransactionDescription): void {
  let contract = DSProtestPause.bind(dataSource.address())
  let fullHash = contract.getTransactionDataHash1(
    event.params.usr,
    event.params.codeHash,
    event.params.parameters,
    event.params.earliestExecutionTime,
  )

  let proposal = DsPauseScheduledTransaction.load(fullHash.toHexString())
  if (proposal != null) {
    proposal.transactionDescription = event.params.description

    proposal.save()
  }
}

export function handleExecuteTransaction(event: ExecuteTransaction): void {
  let contract = DSProtestPause.bind(dataSource.address())
  let fullHash = contract.getTransactionDataHash1(
    event.params.usr,
    event.params.codeHash,
    event.params.parameters,
    event.params.earliestExecutionTime,
  )

  let proposal = DsPauseScheduledTransaction.load(fullHash.toHexString())
  if (proposal != null) {
    proposal.executed = true

    proposal.save()
  }
}

export function handleAbandonTransaction(event: AbandonTransaction): void {
  let contract = DSProtestPause.bind(dataSource.address())
  let fullHash = contract.getTransactionDataHash1(
    event.params.usr,
    event.params.codeHash,
    event.params.parameters,
    event.params.earliestExecutionTime,
  )

  let proposal = DsPauseScheduledTransaction.load(fullHash.toHexString())
  if (proposal != null) {
    proposal.abandoned = true

    proposal.save()
  }
}
