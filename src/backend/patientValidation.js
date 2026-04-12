const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'birthday',
  'age',
  'sex',
  'phone',
  'emergencyContactName',
  'emergencyContactPhone'
]

function toTrimmedString(value) {
  return String(value ?? '').trim()
}

function parseInteger(value) {
  const raw = toTrimmedString(value)

  if (!/^\d+$/.test(raw)) {
    return null
  }

  return Number(raw)
}

function parseBirthday(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const candidate = new Date(value)
  return Number.isNaN(candidate.getTime()) ? null : candidate
}

export function validateAndNormalizePatientPayload(payload = {}) {
  const parsedBirthday = parseBirthday(payload.birthday)

  const fields = {
    firstName: toTrimmedString(payload.firstName),
    lastName: toTrimmedString(payload.lastName),
    birthday: parsedBirthday,
    age: toTrimmedString(payload.age),
    sex: toTrimmedString(payload.sex),
    address: toTrimmedString(payload.address),
    phone: toTrimmedString(payload.phone),
    emergencyContactName: toTrimmedString(payload.emergencyContactName),
    emergencyContactPhone: toTrimmedString(payload.emergencyContactPhone)
  }

  const errors = {}

  REQUIRED_FIELDS.forEach((fieldName) => {
    if (!fields[fieldName]) {
      errors[fieldName] = 'This field is required.'
    }
  })

  const age = parseInteger(fields.age)
  if (fields.age && (age === null || age < 1 || age > 130)) {
    errors.age = 'Age must be a whole number from 1 to 130.'
  }

  if (payload.birthday && !fields.birthday) {
    errors.birthday = 'Birthday must be a valid date.'
  }

  const ok = Object.keys(errors).length === 0
  if (!ok) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    data: {
      firstName: fields.firstName,
      lastName: fields.lastName,
      birthday: fields.birthday,
      age,
      sex: fields.sex,
      address: fields.address,
      phone: fields.phone,
      emergencyContactName: fields.emergencyContactName,
      emergencyContactPhone: fields.emergencyContactPhone
    }
  }
}
