import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import {
    AddAuthorization,
    RemoveAuthorization,
  } from '../../../../generated/StabilityFeeTreasury/StabilityFeeTreasury'

export function handleAddAuthorization(event: AddAuthorization): void {
    addAuthorization(event.params._account, event)
  }
  
  export function handleRemoveAuthorization(event: RemoveAuthorization): void {
    removeAuthorization(event.params._account, event)
  }