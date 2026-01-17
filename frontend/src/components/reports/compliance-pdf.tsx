"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer"
import type { ReportSummary, LocationComplianceReport, ClientComplianceReport } from "@/types"

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottom: "2px solid #93d500",
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#121C26",
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#121C26",
    backgroundColor: "#f5f5f5",
    padding: 8,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #eee",
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: "row",
    borderBottom: "2px solid #121C26",
    paddingVertical: 8,
    backgroundColor: "#f9f9f9",
  },
  col: {
    flex: 1,
  },
  colSmall: {
    width: 60,
    textAlign: "center",
  },
  colMedium: {
    width: 80,
    textAlign: "center",
  },
  bold: {
    fontWeight: "bold",
  },
  statsGrid: {
    flexDirection: "row",
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f5f5f5",
    marginRight: 10,
    borderRadius: 4,
  },
  statBoxLast: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#121C26",
  },
  statLabel: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#999",
    fontSize: 8,
    borderTop: "1px solid #eee",
    paddingTop: 10,
  },
  statusOk: {
    color: "#22c55e",
  },
  statusPending: {
    color: "#eab308",
  },
  statusOverdue: {
    color: "#f97316",
  },
  statusCritical: {
    color: "#ef4444",
  },
})

interface CompliancePDFProps {
  summary: ReportSummary
  clientReports: ClientComplianceReport[]
  locationReports: LocationComplianceReport[]
  periodLabel: string
  clientName?: string
}

// Componente del documento PDF
function CompliancePDFDocument({
  summary,
  clientReports,
  locationReports,
  periodLabel,
  clientName,
}: CompliancePDFProps) {
  const generatedAt = new Date().toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
  })

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "ok":
        return styles.statusOk
      case "pending":
        return styles.statusPending
      case "overdue":
        return styles.statusOverdue
      case "critical":
        return styles.statusCritical
      default:
        return {}
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ok":
        return "OK"
      case "pending":
        return "Pendiente"
      case "overdue":
        return "Atrasado"
      case "critical":
        return "Critico"
      default:
        return status
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Reporte de Compliance</Text>
          <Text style={styles.subtitle}>
            {clientName ? `Cliente: ${clientName}` : "Todos los clientes"} | Periodo: {periodLabel}
          </Text>
          <Text style={styles.subtitle}>Generado: {generatedAt}</Text>
        </View>

        {/* Summary Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen Ejecutivo</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{summary.compliance_rate}%</Text>
              <Text style={styles.statLabel}>Tasa de Cumplimiento</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{summary.total_records}</Text>
              <Text style={styles.statLabel}>Total Registros</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{summary.validated}</Text>
              <Text style={styles.statLabel}>Validados</Text>
            </View>
            <View style={styles.statBoxLast}>
              <Text style={styles.statValue}>{summary.locations_with_issues}</Text>
              <Text style={styles.statLabel}>Con Problemas</Text>
            </View>
          </View>
        </View>

        {/* By Client */}
        {clientReports.length > 0 && !clientName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cumplimiento por Cliente</Text>
            <View style={styles.headerRow}>
              <Text style={[styles.col, styles.bold]}>Cliente</Text>
              <Text style={[styles.colSmall, styles.bold]}>Ubic.</Text>
              <Text style={[styles.colSmall, styles.bold]}>Reg.</Text>
              <Text style={[styles.colMedium, styles.bold]}>Cumpl. %</Text>
            </View>
            {clientReports.slice(0, 10).map((client) => (
              <View key={client.client_id} style={styles.row}>
                <Text style={styles.col}>{client.client_name}</Text>
                <Text style={styles.colSmall}>{client.total_locations}</Text>
                <Text style={styles.colSmall}>{client.total_records}</Text>
                <Text style={styles.colMedium}>{client.compliance_rate}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* By Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado por Ubicacion</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.col, styles.bold]}>Ubicacion</Text>
            <Text style={[styles.col, styles.bold]}>Cliente</Text>
            <Text style={[styles.colSmall, styles.bold]}>Reg.</Text>
            <Text style={[styles.colMedium, styles.bold]}>Cumpl.</Text>
            <Text style={[styles.colMedium, styles.bold]}>Estado</Text>
          </View>
          {locationReports.slice(0, 15).map((loc) => (
            <View key={loc.location_id} style={styles.row}>
              <Text style={styles.col}>{loc.location_name}</Text>
              <Text style={styles.col}>{loc.client_name}</Text>
              <Text style={styles.colSmall}>{loc.total_records}</Text>
              <Text style={styles.colMedium}>{loc.compliance_rate}%</Text>
              <Text style={[styles.colMedium, getStatusStyle(loc.status)]}>
                {getStatusLabel(loc.status)}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Biorem Compliance | www.biorem.mx | Este reporte fue generado automaticamente
        </Text>
      </Page>
    </Document>
  )
}

// Función para generar y descargar el PDF
export async function generateCompliancePDF(props: CompliancePDFProps) {
  const blob = await pdf(<CompliancePDFDocument {...props} />).toBlob()

  // Crear link de descarga
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `reporte-compliance-${new Date().toISOString().split("T")[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
