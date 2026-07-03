import { randomUUID } from 'crypto'
import { faker } from '@faker-js/faker'

/** A snapshot of all dynamic variable values for a single request execution. */
export type DynamicVarSnapshot = Record<string, string>

/**
 * Create a snapshot of dynamic variable values.
 * Called once per request so all `{{$guid}}` tokens in a single request
 * resolve to the same value.
 */
export function createDynamicVarSnapshot(): DynamicVarSnapshot {
  const now = new Date()
  return {
    // Identity / time
    $guid: randomUUID(),
    $randomUUID: randomUUID(),
    $timestamp: String(Math.floor(now.getTime() / 1000)),
    $isoTimestamp: now.toISOString(),
    // Numbers
    $randomInt: String(faker.number.int({ min: 0, max: 1000 })),
    $randomFloat: String(faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })),
    $randomBoolean: String(faker.datatype.boolean()),
    // Person
    $randomFirstName: faker.person.firstName(),
    $randomLastName: faker.person.lastName(),
    $randomFullName: faker.person.fullName(),
    // Internet / web
    $randomEmail: faker.internet.email(),
    $randomUrl: faker.internet.url(),
    $randomDomainName: faker.internet.domainName(),
    $randomPassword: faker.internet.password({ length: 16 }),
    $randomHexColor: faker.color.rgb({ format: 'hex' }),
    // Phone
    $randomPhoneNumber: faker.phone.number(),
    // Location
    $randomCity: faker.location.city(),
    $randomCountry: faker.location.country(),
    // Company / text
    $randomCompanyName: faker.company.name(),
    $randomJobTitle: faker.person.jobTitle(),
    $randomWord: faker.lorem.word(),
    $randomWords: faker.lorem.words(3),
    $randomSentence: faker.lorem.sentence(),
  }
}

/** All known dynamic variable names (without {{ }}) */
export const DYNAMIC_VAR_NAMES = [
  '$guid', '$randomUUID', '$timestamp', '$isoTimestamp',
  '$randomInt', '$randomFloat', '$randomBoolean',
  '$randomFirstName', '$randomLastName', '$randomFullName',
  '$randomEmail', '$randomUrl', '$randomDomainName', '$randomPassword', '$randomHexColor',
  '$randomPhoneNumber',
  '$randomCity', '$randomCountry',
  '$randomCompanyName', '$randomJobTitle',
  '$randomWord', '$randomWords', '$randomSentence',
] as const
