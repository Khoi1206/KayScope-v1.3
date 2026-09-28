import { readFileSync } from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import Handlebars from 'handlebars'
import { getEmailSettings } from '@/db/queries/email_settings'
import { decryptValue } from '@/lib/crypto'
import { AppError } from '@/lib/errors'
import type { EmailSettings } from '@/db/schema'

const TEMPLATES_DIR = path.join(process.cwd(), 'src', 'lib', 'mail', 'templates')

function buildTransporter(settings: EmailSettings) {
  if (!settings.host || !settings.fromAddress) {
    throw new AppError('Email settings are incomplete — set host and from-address first', 400)
  }
  const password = settings.password ? decryptValue(settings.password) : ''
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.username ? { user: settings.username, pass: password } : undefined,
  })
}

function fromHeader(settings: EmailSettings): string {
  return settings.fromName ? `"${settings.fromName}" <${settings.fromAddress}>` : settings.fromAddress
}

/** Sends a plain test email using the currently saved SMTP settings. Throws AppError on failure. */
export async function sendTestEmail(to: string): Promise<void> {
  const settings = await getEmailSettings()
  const transporter = buildTransporter(settings)

  await transporter.sendMail({
    from: fromHeader(settings),
    to,
    subject: 'KayScope test email',
    text: 'This is a test email from KayScope admin settings. If you received this, your SMTP configuration works.',
  })
}

/** Renders and sends a static Handlebars template from src/lib/mail/templates/{locale}/{template}.hbs. */
export async function sendTemplateEmail(
  to: string,
  subject: string,
  template: string,
  locale: 'en' | 'vi',
  context: Record<string, string>
): Promise<void> {
  const settings = await getEmailSettings()
  const transporter = buildTransporter(settings)

  const templatePath = path.join(TEMPLATES_DIR, locale, `${template}.hbs`)
  const source = readFileSync(templatePath, 'utf8')
  const html = Handlebars.compile(source)(context)

  await transporter.sendMail({
    from: fromHeader(settings),
    to,
    subject,
    html,
  })
}
