import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import {
    AddAuthorization,
    RemoveAuthorization,
  } from '../../../../generated/GebPrintingPermissions/GebPrintingPermissions'

export function handleAddAuthorization(event: AddAuthorization): void {
    addAuthorization(event.params.account, event)
  }
  
  export function handleRemoveAuthorization(event: RemoveAuthorization): void {
    removeAuthorization(event.params.account, event)
  }