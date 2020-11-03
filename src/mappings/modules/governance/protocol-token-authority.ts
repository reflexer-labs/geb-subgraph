import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import {
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/ProtocolTokenAuthority/ProtocolTokenAuthority'

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.usr, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.usr, event)
}
