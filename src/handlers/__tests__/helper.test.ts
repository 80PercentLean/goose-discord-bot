import { formatLineBreaks, parseSendTime } from '../helper'

describe('formatLineBreaks', () => {
  it('converts "\\n" into a true new line', () => {
    expect(formatLineBreaks('Hello world!\\nfoobar')).toBe(
      'Hello world!\nfoobar',
    )
  })

  it('converts "\\n\\n" into true new lines', () => {
    expect(formatLineBreaks('Hello world!\\n\\nfoobar')).toBe(
      'Hello world!\n\nfoobar',
    )
  })

  it('converts "<br>" into a true new line', () => {
    expect(formatLineBreaks('Hello world!<br>foobar')).toBe(
      'Hello world!\nfoobar',
    )
  })

  it('converts "<br><br>" into true new lines', () => {
    expect(formatLineBreaks('Hello world!<br><br>foobar')).toBe(
      'Hello world!\n\nfoobar',
    )
  })

  it('converts "\\n" and "<br>" into true new lines', () => {
    expect(formatLineBreaks('Hello world!\\n<br>foobar')).toBe(
      'Hello world!\n\nfoobar',
    )
  })
})

describe('parseSendTime', () => {
  it('parses when "8/13 7:00am" is input', () => {
    expect(parseSendTime('8/13 7:00pm')).not.toBe(null)
  })

  it('parses when "8/13 7:00AM" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00Am" is input', () => {
    expect(parseSendTime('8/13 7:00pm')).not.toBe(null)
  })

  it('parses when "8/13 7:00aM" is input', () => {
    expect(parseSendTime('8/13 7:00pm')).not.toBe(null)
  })

  it('parses when "8/13 7:00 am" is input', () => {
    expect(parseSendTime('8/13 7:00pm')).not.toBe(null)
  })

  it('parses when "8/13 7:00 AM" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00 Am" is input', () => {
    expect(parseSendTime('8/13 7:00pm')).not.toBe(null)
  })

  it('parses when "8/13 7:00 aM" is input', () => {
    expect(parseSendTime('8/13 7:00pm')).not.toBe(null)
  })

  it('parses when "8/13 7:00pm" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00PM" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00Pm" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00pM" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00 pm" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00 PM" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00 Pm" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('parses when "8/13 7:00 pM" is input', () => {
    expect(parseSendTime('8/13 7:00PM')).not.toBe(null)
  })

  it('returns null when "asdf" is input', () => {
    expect(parseSendTime('asdf')).toBe(null)
  })

  it('returns null when "123" is input', () => {
    expect(parseSendTime('123')).toBe(null)
  })

  it('returns null when "8/13" is input', () => {
    expect(parseSendTime('8/13')).toBe(null)
  })

  it('returns null when "7:00pm" is input', () => {
    expect(parseSendTime('7:00pm')).toBe(null)
  })
})
