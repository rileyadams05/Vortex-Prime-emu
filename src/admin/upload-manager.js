import Uppy from '@uppy/core';
import DropTarget from '@uppy/drop-target';

function toPercentage(bytesUploaded, bytesTotal) {
  if (!bytesTotal || bytesTotal <= 0) return 0;
  return Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100));
}

export function createUploadFieldManager({ toast } = {}) {
  const instances = new Map();

  function mountField(options) {
    const {
      id,
      target,
      input,
      progressEl,
      restrictions = {},
      onFileAdded,
      onFileRemoved,
      onValidationError,
    } = options;

    if (!id || !target || !input) return null;

    if (instances.has(id)) {
      try {
        instances.get(id).uppy.close({ reason: 'unmount' });
      } catch (error) {
        console.warn('Failed to close previous Uppy instance', error);
      }
      instances.delete(id);
    }

    const uppy = new Uppy({
      autoProceed: false,
      allowMultipleUploads: false,
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: restrictions.allowedFileTypes || null,
        maxFileSize: restrictions.maxFileSize ?? null,
      },
    });

    const instance = {
      uppy,
      target,
      input,
      progressEl,
      barEl: progressEl?.querySelector('.upload-progress__bar') || null,
      labelEl: progressEl?.querySelector('.upload-progress__label') || null,
      currentFileId: null,
      bytesTotal: 0,
    };

    instances.set(id, instance);

    const clearDragClass = () => target.classList.remove('dragover');

    uppy.use(DropTarget, {
      target,
      onDragOver: () => target.classList.add('dragover'),
      onDragLeave: clearDragClass,
      onDrop: clearDragClass,
    });

    target.addEventListener('click', () => {
      if (!input.disabled) {
        input.click();
      }
    });

    input.addEventListener('change', (event) => {
      const files = Array.from(event.target.files || []);
      files.forEach((file) => {
        try {
          uppy.addFile({
            source: 'vortex-prime-input',
            name: file.name,
            type: file.type,
            data: file,
          });
        } catch (error) {
          console.error('Unable to add file to Uppy', error);
          toast?.('Unable to add that file. Please try another file.', 'error');
        }
      });
      input.value = '';
    });

    uppy.on('file-added', (file) => {
      instance.currentFileId = file.id;
      instance.bytesTotal = file.data?.size ?? 0;
      resetProgress(id);
      onFileAdded?.(file);
    });

    uppy.on('file-removed', (file) => {
      if (instance.currentFileId === file.id) {
        instance.currentFileId = null;
        instance.bytesTotal = 0;
      }
      resetProgress(id);
      onFileRemoved?.(file);
    });

    uppy.on('restriction-failed', (file, error) => {
      const message = error?.message || 'That file does not meet the upload rules.';
      toast?.(message, 'error');
      onValidationError?.(file, error);
    });

    return instance;
  }

  function getInstance(id) {
    return instances.get(id) || null;
  }

  function setUploading(id, uploading) {
    const instance = getInstance(id);
    if (!instance) return;
    instance.target.classList.toggle('upload-disabled', Boolean(uploading));
    instance.input.disabled = Boolean(uploading);
  }

  function resetProgress(id) {
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;
    instance.progressEl.classList.remove('is-active');
    instance.progressEl.dataset.state = '';
    if (instance.barEl) instance.barEl.style.width = '0%';
    if (instance.labelEl) instance.labelEl.textContent = 'Ready';
  }

  function updateProgress(id, { bytesUploaded, bytesTotal, message }) {
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;

    if (bytesTotal && bytesTotal > 0) {
      instance.bytesTotal = bytesTotal;
    }

    const total = instance.bytesTotal || bytesTotal || 0;
    const uploaded = bytesUploaded ?? 0;
    const percentage = toPercentage(uploaded, total);

    instance.progressEl.classList.add('is-active');
    instance.progressEl.dataset.state = 'progress';

    if (instance.barEl) {
      instance.barEl.style.width = `${percentage}%`;
    }
    if (instance.labelEl) {
      instance.labelEl.textContent = message || `Uploading… ${percentage}%`;
    }

    if (instance.currentFileId) {
      const file = instance.uppy.getFile(instance.currentFileId);
      if (file) {
        instance.uppy.setFileState(instance.currentFileId, {
          progress: {
            uploadStarted: true,
            uploadComplete: percentage >= 100,
            percentage,
            bytesUploaded: uploaded,
            bytesTotal: total,
          },
        });
        instance.uppy.emit('upload-progress', file, {
          bytesUploaded: uploaded,
          bytesTotal: total,
        });
      }
    }
  }

  function markComplete(id, { message, bytesUploaded, bytesTotal } = {}) {
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;

    instance.progressEl.classList.add('is-active');
    instance.progressEl.dataset.state = 'complete';

    if (instance.barEl) instance.barEl.style.width = '100%';
    if (instance.labelEl) instance.labelEl.textContent = message || 'Upload complete';

    if (instance.currentFileId) {
      const file = instance.uppy.getFile(instance.currentFileId);
      if (file) {
        const total = bytesTotal || instance.bytesTotal || file.data?.size || 0;
        const uploaded = bytesUploaded || total;
        instance.uppy.setFileState(instance.currentFileId, {
          progress: {
            uploadStarted: true,
            uploadComplete: true,
            percentage: 100,
            bytesUploaded: uploaded,
            bytesTotal: total,
          },
        });
        instance.uppy.emit('upload-success', file, { status: 'ok' });
      }
    }
  }

  function markError(id, message) {
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;

    instance.progressEl.classList.add('is-active');
    instance.progressEl.dataset.state = 'error';

    if (instance.barEl) instance.barEl.style.width = '100%';
    if (instance.labelEl) instance.labelEl.textContent = message || 'Upload failed';

    if (instance.currentFileId) {
      const file = instance.uppy.getFile(instance.currentFileId);
      if (file) {
        instance.uppy.emit('upload-error', file, new Error(message || 'Upload failed'));
      }
    }
  }

  function destroyAll() {
    instances.forEach((instance) => {
      try {
        instance.uppy.close({ reason: 'destroy' });
      } catch (error) {
        console.warn('Failed to close Uppy instance', error);
      }
    });
    instances.clear();
  }

  return {
    mountField,
    setUploading,
    resetProgress,
    updateProgress,
    markComplete,
    markError,
    destroyAll,
    getInstance,
  };
}

export default {
  createUploadFieldManager,
};
