import { downloadBlob } from './client'

export function downloadCertificate(certificateId: number, filename: string): Promise<void> {
  return downloadBlob(`/api/v1/certificates/${certificateId}/download`, filename)
}
