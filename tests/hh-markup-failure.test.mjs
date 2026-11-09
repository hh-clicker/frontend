import test from 'node:test'
import assert from 'node:assert/strict'
import { isHhMarkupFailure } from '../src/services/hhMarkupFailure.ts'

test('markup failures expose diagnostics while login, access and network failures do not', () => {
  assert.equal(isHhMarkupFailure('Не удалось распознать страницу профиля.'), true)
  assert.equal(isHhMarkupFailure('Выдача не загрузилась или изменилась разметка HH.'), true)
  assert.equal(isHhMarkupFailure('HH запросил вход. Авторизуйтесь.'), false)
  assert.equal(isHhMarkupFailure('Вам недоступна эта вакансия.'), false)
  assert.equal(isHhMarkupFailure('Не удалось связаться с Browser Agent.'), false)
  assert.equal(isHhMarkupFailure(null), false)
})
