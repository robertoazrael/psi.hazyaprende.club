type StatusTone = 'default' | 'error' | 'success';

type SetupWebhookFormOptions = {
  selector: string;
  loadingMessage: string;
  successMessage?: string;
  errorMessage: string;
  getPayload: (formData: FormData, interactionDelay: number) => Record<string, unknown>;
  onSuccess?: (context: { form: HTMLFormElement; status: HTMLElement }) => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const setStatus = (node: HTMLElement | null, message: string, tone: StatusTone = 'default') => {
  if (!node) {
    return;
  }

  node.textContent = message;

  if (tone === 'error') {
    node.style.color = '#b04b4b';
    return;
  }

  if (tone === 'success') {
    node.style.color = 'var(--primary)';
    return;
  }

  node.style.color = 'var(--text-soft)';
};

const normalizeTextFields = (form: HTMLFormElement) => {
  const fields = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input[type="email"], input[type="tel"], textarea');

  fields.forEach((field) => {
    field.value = field.value.trim();
  });
};

const hasValidRequiredFields = (form: HTMLFormElement) => {
  const nombre = form.elements.namedItem('nombre');
  const email = form.elements.namedItem('email');

  if (!(nombre instanceof HTMLInputElement) || !(email instanceof HTMLInputElement)) {
    return false;
  }

  if (!nombre.value.trim()) {
    nombre.reportValidity();
    return false;
  }

  if (!email.value.trim()) {
    email.reportValidity();
    return false;
  }

  if (!EMAIL_REGEX.test(email.value.trim())) {
    email.setCustomValidity('Ingresa un correo electrónico válido.');
    email.reportValidity();
    email.setCustomValidity('');
    return false;
  }

  email.setCustomValidity('');
  return form.reportValidity();
};

export const setupWebhookForm = ({
  selector,
  loadingMessage,
  successMessage,
  errorMessage,
  getPayload,
  onSuccess
}: SetupWebhookFormOptions) => {
  const forms = document.querySelectorAll<HTMLFormElement>(selector);

  forms.forEach((form) => {
    const status = form.querySelector<HTMLElement>('[data-status]');
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (!submitButton) {
      return;
    }

    const defaultButtonText = submitButton.textContent ?? '';
    const startedAt = Date.now();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      normalizeTextFields(form);

      if (!hasValidRequiredFields(form)) {
        return;
      }

      const endpoint = form.dataset.endpoint?.trim();

      if (!endpoint) {
        setStatus(status, errorMessage, 'error');
        return;
      }

      const interactionDelay = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const payload = getPayload(new FormData(form), interactionDelay);

      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
      submitButton.textContent = 'Enviando...';
      form.setAttribute('aria-busy', 'true');
      setStatus(status, loadingMessage);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error('request_failed');
        }

        const data = await response.json().catch(() => null);

        if (!data || data.ok !== true) {
          throw new Error('invalid_response');
        }

        if (successMessage) {
          setStatus(status, successMessage, 'success');
        }

        onSuccess?.({ form, status: status ?? document.createElement('p') });
      } catch {
        submitButton.disabled = false;
        submitButton.removeAttribute('aria-busy');
        submitButton.textContent = defaultButtonText;
        form.removeAttribute('aria-busy');
        setStatus(status, errorMessage, 'error');
      }
    });
  });
};
