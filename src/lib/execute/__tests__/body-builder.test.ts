import { describe, it, expect } from 'vitest'
import { buildRequestBody } from '../body-builder'
import { emptyScopes } from '@/core/interpolation/scope'
import type { RequestBody } from '@/db/schema'

describe('buildRequestBody — graphql', () => {
  it('serializes query, variables, and operationName into a JSON body', async () => {
    const body: RequestBody = {
      type: 'graphql',
      content: '',
      graphqlQuery: 'query GetUser($id: ID!) { user(id: $id) { name } }',
      graphqlVariables: '{"id": "42"}',
      graphqlOperationName: 'GetUser',
    }
    const result = await buildRequestBody(body, emptyScopes())
    expect(result.contentType).toBe('application/json')
    expect(JSON.parse(result.body as string)).toEqual({
      query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
      variables: { id: '42' },
      operationName: 'GetUser',
    })
  })

  it('omits operationName when not set', async () => {
    const body: RequestBody = { type: 'graphql', content: '', graphqlQuery: '{ ping }' }
    const result = await buildRequestBody(body, emptyScopes())
    const parsed = JSON.parse(result.body as string)
    expect(parsed).toEqual({ query: '{ ping }', variables: {} })
    expect(parsed.operationName).toBeUndefined()
  })

  it('falls back to an empty variables object on invalid JSON rather than throwing', async () => {
    const body: RequestBody = { type: 'graphql', content: '', graphqlQuery: '{ ping }', graphqlVariables: '{not valid json' }
    const result = await buildRequestBody(body, emptyScopes())
    const parsed = JSON.parse(result.body as string)
    expect(parsed.variables).toEqual({})
  })

  it('interpolates {{variable}} tokens in query, variables, and operationName', async () => {
    const scopes = { ...emptyScopes(), environment: { userId: '7', opName: 'GetUser' } }
    const body: RequestBody = {
      type: 'graphql',
      content: '',
      graphqlQuery: 'query { user(id: "{{userId}}") { name } }',
      graphqlVariables: '{"id": "{{userId}}"}',
      graphqlOperationName: '{{opName}}',
    }
    const result = await buildRequestBody(body, scopes)
    const parsed = JSON.parse(result.body as string)
    expect(parsed.query).toContain('user(id: "7")')
    expect(parsed.variables).toEqual({ id: '7' })
    expect(parsed.operationName).toBe('GetUser')
  })
})
