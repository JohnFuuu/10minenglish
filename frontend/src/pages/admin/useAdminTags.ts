import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { fetchAdminTags, type AdminTag } from '../../lib/api';

// The managed tag list, for the Members tab (filter + picker) and the Tags tab.
export function useAdminTags() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [tags, setTags] = useState<AdminTag[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      setTags((await fetchAdminTags(token)).tags);
    } catch {
      showToast('Could not load member tags.', 'error');
    }
  }, [token, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tags, reload };
}
