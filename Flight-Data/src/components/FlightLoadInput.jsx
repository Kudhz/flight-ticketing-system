import { Plus, Save, Trash2 } from "lucide-react";
import { Alert, Button, Form, Table, Card } from "react-bootstrap";

export default function FlightLoadInput({
  records,
  status,
  theme,
  isLoading,
  isSaving,
  onAdd,
  onChange,
  onDelete,
  onSave,
}) {
  const fields = [
    { key: "date", label: "Tanggal", step: "1", min: "1", max: "31" },
    { key: "pax", label: "Jumlah PAX", step: "1", min: "0" },
    { key: "passengerWeight", label: "Berat PAX (KG)", step: "0.01", min: "0" },
    { key: "baggagePieces", label: "Koli Bagasi", step: "1", min: "0" },
    {
      key: "baggageWeight",
      label: "Berat Bagasi (KG)",
      step: "0.01",
      min: "0",
    },
    {
      key: "cabinBaggagePieces",
      label: "Koli Bagasi Cabin",
      step: "1",
      min: "0",
    },
    {
      key: "cabinBaggageWeight",
      label: "Berat Bagasi Cabin (KG)",
      step: "0.01",
      min: "0",
    },
    { key: "cargoPieces", label: "Koli Cargo", step: "1", min: "0" },
    { key: "cargoWeight", label: "Berat Cargo (KG)", step: "0.01", min: "0" },
  ];

  return (
    <>
      <Alert variant={status.variant} role="status">
        {status.message}
      </Alert>
      <Card className="shadow-sm">
        <Table
          responsive
          hover
          className="mb-0"
          variant={theme === "dark" ? "dark" : "light"}
        >
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field.key}>{field.label}</th>
              ))}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {fields.map((field) => (
                  <td key={field.key}>
                    <Form.Control
                      aria-label={field.label}
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={record[field.key]}
                      placeholder={
                        field.key.includes("Weight") ? "KG" : field.label
                      }
                      onChange={(event) =>
                        onChange(record.id, field.key, event.target.value)
                      }
                    />
                  </td>
                ))}
                <td>
                  <Button
                    variant="danger"
                    onClick={() => onDelete(record.id)}
                    aria-label="Hapus data penerbangan"
                  >
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={fields.length + 1}
                  className="text-center text-muted"
                >
                  Belum ada baris input. Tambahkan data penerbangan.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      <div className="d-flex flex-wrap gap-3 mt-4">
        <Button
          variant="primary"
          onClick={onAdd}
          disabled={isLoading || isSaving}
        >
          <Plus size={18} className="me-2" />
          Tambah Data
        </Button>
        <Button
          variant="success"
          onClick={onSave}
          disabled={isLoading || isSaving}
        >
          <Save size={18} className="me-2" />
          {isSaving ? "Menyimpan..." : "Simpan Data Berat & Bagasi"}
        </Button>
      </div>
    </>
  );
}
