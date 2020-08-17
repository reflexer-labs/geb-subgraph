import { Bytes, BigDecimal, ethereum, Address } from "@graphprotocol/graph-ts";
import { UserProxy, InternalBondBalance, InternalCollateralBalance, InternalDebtBalance  } from "../../generated/schema";

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'

export function createBondBalance(address: Bytes, balance: BigDecimal, event: ethereum.Event) : InternalBondBalance {
    let bal = new InternalBondBalance(address.toHexString())
    bal.accountHandler = address
    let proxy = UserProxy.load(address.toHexString())
    if(proxy != null) {
      bal.owner = Address.fromString(proxy.owner)
      bal.proxy = proxy.address.toHexString()
    } else {
      bal.owner = address
    }
    bal.balance = balance
    bal.createdAt = event.block.timestamp
    bal.createdAtBlock = event.block.number
    bal.createdAtTransaction = event.transaction.hash
  
    return bal
}


export function updateBondBalance(balance: InternalBondBalance, amount: BigDecimal, event: ethereum.Event) : void {
    balance.balance = amount
    balance.modifiedAt = event.block.timestamp
    balance.modifiedAtBlock = event.block.number
    balance.modifiedAtTransaction = event.transaction.hash
}

export function createCollateralBalance(address: Bytes, collateralType: Bytes, balance: BigDecimal, event: ethereum.Event) : InternalCollateralBalance{
    let bal = new InternalCollateralBalance(address.toHexString() + '-' + collateralType)
    bal.accountHandler = address
    let proxy = UserProxy.load(address.toHexString())
    if(proxy != null) {
        bal.owner = Address.fromString(proxy.owner)
        bal.proxy = proxy.address.toHexString()
    } else {
        bal.owner = address
    }
    bal.collateralType = collateralType.toString()
    bal.balance = balance
    bal.createdAt = event.block.timestamp
    bal.createdAtBlock = event.block.number
    bal.createdAtTransaction = event.transaction.hash

    return bal
}

export function updateCollateralBalance(balance: InternalCollateralBalance, amount: BigDecimal, event: ethereum.Event) :void {
    balance.balance = amount
    balance.modifiedAt = event.block.timestamp
    balance.modifiedAtBlock = event.block.number
    balance.modifiedAtTransaction = event.transaction.hash
}

export function createDebtBalance(address: Bytes, balance: BigDecimal, event: ethereum.Event) : InternalDebtBalance {
    let bal = new InternalCollateralBalance(address.toHexString())
    bal.accountHandler = address
    bal.owner = address
    bal.balance = balance
    bal.createdAt = event.block.timestamp
    bal.createdAtBlock = event.block.number
    bal.createdAtTransaction = event.transaction.hash

    return bal
}

export function updateDebtBalance(balance: InternalDebtBalance, amount: BigDecimal, event: ethereum.Event) : void {
    balance.balance = amount
    balance.modifiedAt = event.block.timestamp
    balance.modifiedAtBlock = event.block.number
    balance.modifiedAtTransaction = event.transaction.hash
}

