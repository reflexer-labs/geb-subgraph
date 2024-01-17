import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts'

const ADDRESS_LENGTH = 20

export function toAddress(address: Bytes): Address {
  return Address.fromString(address.toHex().substr(-40)) as Address
}

export function toSignedInt(
  value: Bytes,
  signed: boolean = false,
  bigEndian: boolean = true,
): BigInt {
  return BigInt.fromSignedBytes(bigEndian ? (value.reverse() as Bytes) : value)
}

export function toUnsignedInt(value: Bytes, bigEndian: boolean = true): BigInt {
  if (bigEndian) {
    return BigInt.fromUnsignedBytes(value.reverse() as Bytes)
  } else {
    return BigInt.fromUnsignedBytes(value)
  }
}

export let ETH_A = Bytes.fromHexString(
  '0x4554482d41000000000000000000000000000000000000000000000000000000',
) as Bytes
