#!/usr/bin/env ts-node
import {Observable} from 'rxjs'
import {filter, map, skip} from 'rxjs/operators'
import fs from 'fs'
import readline from 'readline'

enum Category {
  business = 'business',
  charity = 'charity',
  haircut = 'haircut',
  clothing = 'clothing',
  entertainment = 'entertainment',
  groceries = 'groceries',
  hobby = 'hobby',
  homewares = 'homewares',
  hosting = 'hosting',
  internet = 'internet',
  medical = 'medical',
  outing = 'outing',
  phone = 'phone',
  political = 'political',
  savings = 'savings',
  takeaway = 'takeaway',
  transport = 'transport',
  utilities = 'utilities',
}

interface Transaction {
  date: string
  description: string
  category?: Category
  amount: number
  runningTotal: number
}

const [, , csvPath] = process.argv

const getMappings = () => {
  const rawMappings = fs.readFileSync('./mapping.yml', 'utf-8').split('\n')
  const mappings: Record<string, Category> = {}

  for (const rawMapping of rawMappings) {
    const [substring, category] = rawMapping.split(/: */)
    if (substring && category && isCategory(category)) mappings[substring] = category
  }

  return mappings
}

const getFileLine$ = (path: string) =>
  new Observable<string>((observer) => {
    const reader = readline.createInterface({
      input: fs.createReadStream(path),
      crlfDelay: Infinity,
    })

    const processLine = (line: string) => observer.next(line)
    const close = () => observer.complete()

    reader.on('line', processLine)
    reader.on('close', close)

    return () => {
      reader.off('line', processLine)
      reader.off('close', close)
    }
  })

const categoriseTransaction = (transaction: Transaction) => {
  const description = cleanDescription(transaction.description)
  const mappings = getMappings()
  for (const [substring, category] of Object.entries(mappings)) {
    if (description.includes(substring)) {
      transaction.category = category
    }
  }
  return transaction
}

const cleanDescription = (description: string) => description.replace(/^VISA-/, '').replace(/\s\s+/g, ' ').toLowerCase()

const extractTransaction = (line: string): Transaction => {
  const [, date, description, amount, runningTotal] = [
    ...line.matchAll(/(")?([^,]*?)(")?(,|$)/gi),
  ].map((values) => values[2])

  if (!runningTotal || !amount || !description || !date) throw new Error(`Could not parse ${line}`)
  return {date, description, amount: parseFloat(amount), runningTotal: parseFloat(runningTotal)}
}

const isCategory = (category: string): category is Category => category in Category

if (csvPath) {
  const fileLine$ = getFileLine$(csvPath)
  const transaction$ = fileLine$.pipe(skip(1), map(extractTransaction), map(categoriseTransaction))
  transaction$.pipe(filter((transaction) => !transaction.category)).subscribe(transaction => console.log(transaction.description))
}
