import { Address, ethereum, log } from '@graphprotocol/graph-ts'
import { ERC20Balance, ERC20Allowance, UserProxy } from '../entities'
import * as decimal from '../utils/decimal'

export function getOrCreateERC20Balance(
  address: Address,
  tokenAddress: Address,
  event: ethereum.Event,
  canCreate: boolean = true,
  label: string = null,
): ERC20Balance {
  let id = tokenAddress.toHexString() + '-' + address.toHexString()
  let balance = ERC20Balance.load(id)
  if (balance == null) {
    if (!canCreate) {
      log.critical("ERC20 balance does not exist and can't be created: {}", [id])
    }
    balance = new ERC20Balance(id)
    balance.tokenAddress = tokenAddress
    balance.address = address
    balance.balance = decimal.ZERO

    if (label) {
      balance.label = label
    }

    // If a proxy with that address exist, set its owner to the owner of the balance
    let proxy = UserProxy.load(address.toHexString())
    balance.owner = proxy ? proxy.owner.toString() : address.toHexString()

    balance.modifiedAt = event.block.timestamp
    balance.modifiedAtBlock = event.block.number
    balance.modifiedAtTransaction = event.transaction.hash
  }
  balance.save()
  return balance as ERC20Balance
}

export function getOrCreateERC20BAllowance(
  address: Address,
  tokenAddress: Address,
  approvedAddress: Address,
  event: ethereum.Event,
  canCreate: boolean = true,
): ERC20Allowance {
  let id =
    tokenAddress.toHexString() + '-' + address.toHexString() + '-' + approvedAddress.toHexString()
  let allowance = ERC20Allowance.load(id)

  if (allowance == null) {
    if (!canCreate) {
      log.critical("ERC20 allowance does not exist and can't be created: {}", [id])
    }

    let balance = ERC20Balance.load(tokenAddress.toHexString() + '-' + address.toHexString())

    // Need to create the balance in case we approve an empty balance
    if (balance == null) {
      balance = getOrCreateERC20Balance(address, tokenAddress, event)
    }

    allowance = new ERC20Allowance(id)
    allowance.tokenAddress = tokenAddress
    allowance.address = address
    allowance.balance = balance.id
    allowance.approvedAddress = approvedAddress
    allowance.amount = decimal.ZERO
    allowance.modifiedAt = event.block.timestamp
    allowance.modifiedAtBlock = event.block.number
    allowance.modifiedAtTransaction = event.transaction.hash
  }
  allowance.save()
  return allowance as ERC20Allowance
}
