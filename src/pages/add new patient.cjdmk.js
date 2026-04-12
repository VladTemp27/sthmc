import wixLocation from 'wix-location'
import { savePatient } from 'backend/patients'

const FIELD_SELECTORS = {
  firstName: ['#patientFirstName', '#patientFirstNameInput', '#firstNameInput'],
  lastName: ['#patientLastName', '#patientLastNameInput', '#lastNameInput'],
  birthday: ['#patientBirthday', '#birthdayInput'],
  age: ['#patientAge', '#ageInput'],
  sex: ['#patientSex', '#sexDropdown'],
  address: ['#patientAddress', '#addressInput'],
  phone: ['#patientPhone', '#phoneInput'],
  emergencyContactName: ['#emergencyContactName', '#emergencyContactNameInput'],
  emergencyContactPhone: ['#emergencyContactPhone', '#emergencyContactPhoneInput']
}

const MESSAGE_SELECTORS = ['#formMessageText', '#formMessage']
const SUBMITTING_LABEL = 'Submitting...'
const DEFAULT_SUBMIT_LABEL = 'Submit'
const LOG_PREFIX = '[AddPatientForm]'
const SUCCESS_REDIRECT_PATH = '/homepage'
const REQUIRED_ELEMENT_KEYS = [
  'firstName',
  'lastName',
  'birthday',
  'age',
  'sex',
  'phone',
  'emergencyContactName',
  'emergencyContactPhone'
]

let isSubmitting = false
let cachedElements = null

function getElement(selectors) {
  for (const selector of selectors) {
    try {
      const element = $w(selector)
      if (element) {
        return element
      }
    } catch (error) {
      continue
    }
  }

  return null
}

function collectPayload(elements) {
  return {
    firstName: elements.firstName && 'value' in elements.firstName ? elements.firstName.value : undefined,
    lastName: elements.lastName && 'value' in elements.lastName ? elements.lastName.value : undefined,
    birthday: elements.birthday && 'value' in elements.birthday ? elements.birthday.value : undefined,
    age: elements.age && 'value' in elements.age ? elements.age.value : undefined,
    sex: elements.sex && 'value' in elements.sex ? elements.sex.value : undefined,
    address: elements.address && 'value' in elements.address ? elements.address.value : undefined,
    phone: elements.phone && 'value' in elements.phone ? elements.phone.value : undefined,
    emergencyContactName:
      elements.emergencyContactName && 'value' in elements.emergencyContactName
        ? elements.emergencyContactName.value
        : undefined,
    emergencyContactPhone:
      elements.emergencyContactPhone && 'value' in elements.emergencyContactPhone
        ? elements.emergencyContactPhone.value
        : undefined
  }
}

function getMissingRequiredElements(elements) {
  return REQUIRED_ELEMENT_KEYS.filter((key) => !elements[key])
}

function clearFieldValidity(elements) {
  Object.keys(elements).forEach((fieldKey) => {
    const element = elements[fieldKey]
    if (element && element.resetValidityIndication) {
      element.resetValidityIndication()
    }
  })
}

function applyValidationErrors(fieldErrors = {}, elements = {}) {
  Object.keys(fieldErrors).forEach((fieldKey) => {
    const element = elements[fieldKey]
    if (!element) {
      return
    }

    if (element.updateValidityIndication) {
      element.updateValidityIndication()
    }
  })
}

function resetFormValues(elements) {
  Object.keys(elements).forEach((fieldKey) => {
    const element = elements[fieldKey]
    if (element && element.reset) {
      element.reset()
    } else if (element && 'value' in element) {
      element.value = ''
    }
  })
}

function collectElements() {
  return {
    firstName: getElement(FIELD_SELECTORS.firstName),
    lastName: getElement(FIELD_SELECTORS.lastName),
    birthday: getElement(FIELD_SELECTORS.birthday),
    age: getElement(FIELD_SELECTORS.age),
    sex: getElement(FIELD_SELECTORS.sex),
    address: getElement(FIELD_SELECTORS.address),
    phone: getElement(FIELD_SELECTORS.phone),
    emergencyContactName: getElement(FIELD_SELECTORS.emergencyContactName),
    emergencyContactPhone: getElement(FIELD_SELECTORS.emergencyContactPhone)
  }
}

function logMissingElements(elements) {
  const missing = Object.keys(elements).filter((key) => !elements[key])

  if (missing.length > 0) {
    console.warn(`${LOG_PREFIX} Missing expected elements:`, missing)
  } else {
    console.log(`${LOG_PREFIX} All expected form elements were found.`)
  }
}

function setMessage(text, isError = false) {
  const messageElement = getElement(MESSAGE_SELECTORS)
  if (!messageElement) {
    return
  }

  messageElement.text = text

  if (messageElement.style && 'color' in messageElement.style) {
    messageElement.style.color = isError ? '#C81E1E' : '#1B7F3A'
  }
}

function setSubmittingState(isSubmittingState) {
  const submitButton = $w('#submitButton')

  if (isSubmittingState) {
    submitButton.disable()
  } else {
    submitButton.enable()
  }

  if ('label' in submitButton) {
    submitButton.label = isSubmittingState ? SUBMITTING_LABEL : DEFAULT_SUBMIT_LABEL
  }
}

async function handleSubmit() {
  if (isSubmitting) {
    console.log(`${LOG_PREFIX} Submit ignored: already submitting.`)
    return
  }

  console.log(`${LOG_PREFIX} Submit started.`)
  isSubmitting = true
  setSubmittingState(true)
  const elements = cachedElements || collectElements()
  const missingRequiredElements = getMissingRequiredElements(elements)

  if (missingRequiredElements.length > 0) {
    console.error(`${LOG_PREFIX} Missing required elements, aborting submit.`, missingRequiredElements)
    setMessage('Form is not fully connected. Please check element IDs and try again.', true)
    isSubmitting = false
    setSubmittingState(false)
    return
  }

  clearFieldValidity(elements)
  setMessage('Saving patient...')

  try {
    const payload = collectPayload(elements)
    console.log(`${LOG_PREFIX} Payload collected.`, {
      hasFirstName: Boolean(payload.firstName),
      hasLastName: Boolean(payload.lastName),
      hasBirthday: Boolean(payload.birthday),
      hasAge: Boolean(payload.age),
      hasSex: Boolean(payload.sex),
      hasPhone: Boolean(payload.phone),
      hasEmergencyContactName: Boolean(payload.emergencyContactName),
      hasEmergencyContactPhone: Boolean(payload.emergencyContactPhone)
    })

    const result = await savePatient(payload)
    console.log(`${LOG_PREFIX} Backend responded.`, {
      ok: result && result.ok,
      type: (result && result.type) || 'success'
    })

    if (!result.ok) {
      if (result.type === 'validation') {
        console.log(`${LOG_PREFIX} Validation errors returned.`, result.fields)
        applyValidationErrors(result.fields, elements)
      }

      setMessage(result.message || 'Unable to save patient record.', true)
      console.log(`${LOG_PREFIX} Submit failed:`, result.message)
      return
    }

    resetFormValues(elements)
    setMessage('Patient saved successfully.')
    console.log(`${LOG_PREFIX} Submit succeeded.`, { patientId: result && result.patientId })
    wixLocation.to(SUCCESS_REDIRECT_PATH)
  } catch (error) {
    console.error(`${LOG_PREFIX} Submit exception.`, error)
    setMessage('Something went wrong while saving. Please try again.', true)
  } finally {
    isSubmitting = false
    setSubmittingState(false)
    console.log(`${LOG_PREFIX} Submit flow finished.`)
  }
}

$w.onReady(function () {
  try {
    console.log(`${LOG_PREFIX} Page ready. Wiring submit button.`)
    cachedElements = collectElements()
    logMissingElements(cachedElements)
    setMessage('')

    const submitButton = $w('#submitButton')
    submitButton.onClick(handleSubmit)

    console.log(`${LOG_PREFIX} Submit handler attached to #submitButton.`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed during onReady wiring.`, error)
  }
})
