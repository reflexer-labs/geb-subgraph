import { BigInt, Bytes } from '@graphprotocol/graph-ts'

export { BigInt }

export let ONE = BigInt.fromI32(1)
export let ZERO = BigInt.fromI32(0)
export let MAX_UINT_256 = BigInt.fromUnsignedBytes(
  Bytes.fromHexString('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') as Bytes,
)
export let HOUR = BigInt.fromI32(60).times(BigInt.fromI32(60))
export let DAY = HOUR.times(BigInt.fromI32(24))
export let SECOND_PER_YEAR = BigInt.fromI32(31536000)

export function fromNumber(value: i32): BigInt {
  return BigInt.fromI32(value)
}

export function fromString(value: string): BigInt {
  return BigInt.fromString(value)
}
