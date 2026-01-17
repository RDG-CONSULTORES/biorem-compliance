"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Svg,
  Path,
  G,
} from "@react-pdf/renderer"
import type { ReportSummary, LocationComplianceReport, ClientComplianceReport } from "@/types"

// Logo de Biorem como componente SVG
function BioremLogo({ width = 120 }: { width?: number }) {
  const scale = width / 206.16
  const height = 60.56 * scale

  return (
    <Svg width={width} height={height} viewBox="0 0 206.16 60.56">
      <G>
        {/* Círculo verde (izquierda) */}
        <Path
          fill="#93d500"
          d="M63.92,33.29c-.12-.06-.13,3.92-3.1,9.92-1.51,2.95-3.85,6.34-7.37,9.36-3.5,3.02-8.21,5.64-13.81,6.8-5.56,1.16-12.03.83-18.02-1.8-5.99-2.57-11.36-7.55-14.41-14.01-3.07-6.41-3.69-14.31-1.19-21.37,2.46-7.06,8.14-13.06,15.24-15.85,7.04-2.86,15.37-2.47,21.95,1.14,6.62,3.55,11.27,10.21,12.51,17.27,1.33,7.08-.67,14.41-4.99,19.44-4.26,5.12-10.5,7.92-16.36,8.18-5.92.35-11.33-1.75-15.09-4.92-3.81-3.16-6-7.23-6.97-10.86-.97-3.66-.82-6.9-.39-9.28.45-2.38,1.13-3.96,1.49-4.75,2.9-6.45,8.73-10.17,13.15-11.45,4.49-1.37,7.59-1,7.63-1.49.09-.31-3.01-1.51-8.14-.57-2.53.48-5.49,1.6-8.3,3.63-2.8,2.01-5.4,4.98-7.07,8.64-.41.91-1.19,2.73-1.68,5.47-.47,2.72-.61,6.4.54,10.55,1.14,4.11,3.67,8.68,8,12.2,4.26,3.53,10.42,5.81,16.96,5.35,6.52-.37,13.37-3.55,17.99-9.24,4.7-5.6,6.77-13.66,5.24-21.3-1.44-7.64-6.54-14.73-13.69-18.46-7.11-3.79-15.95-4.07-23.35-.96-7.46,3.04-13.34,9.42-15.82,16.84-2.52,7.43-1.76,15.59,1.49,22.18,3.23,6.63,8.82,11.67,14.99,14.23,6.18,2.63,12.77,2.87,18.39,1.62,5.67-1.25,10.4-3.96,13.89-7.05,3.51-3.1,5.83-6.53,7.3-9.52,2.9-6.06,2.86-10.03,2.98-9.98Z"
        />
        {/* Círculo azul (derecha) */}
        <Path
          fill="#0083ad"
          d="M0,26.3c.12.06.26-3.92,3.42-9.82,1.6-2.9,4.06-6.21,7.67-9.13,3.59-2.91,8.39-5.38,14.03-6.36,5.6-.98,12.06-.45,17.97,2.39,5.91,2.77,11.12,7.92,13.96,14.48,2.87,6.51,3.23,14.43.5,21.42-2.69,6.99-8.57,12.8-15.75,15.37-7.14,2.64-15.46,1.98-21.92-1.85-6.51-3.77-10.94-10.57-11.96-17.68-1.1-7.12,1.13-14.4,5.62-19.29,4.43-4.99,10.76-7.58,16.63-7.66,5.94-.16,11.28,2.11,14.93,5.41,3.71,3.29,5.77,7.43,6.62,11.09.86,3.69.6,6.93.09,9.29-.52,2.37-1.26,3.92-1.64,4.7-3.1,6.36-9.06,9.89-13.52,11.03-4.54,1.22-7.63.76-7.68,1.25-.1.31,2.96,1.61,8.13.83,2.55-.4,5.55-1.42,8.42-3.36,2.87-1.92,5.56-4.81,7.35-8.41.44-.9,1.28-2.69,1.86-5.42.56-2.7.82-6.38-.2-10.58-1.01-4.15-3.39-8.8-7.61-12.46-4.15-3.67-10.24-6.15-16.8-5.89-6.53.16-13.49,3.12-18.29,8.66-4.88,5.45-7.21,13.45-5.92,21.14,1.2,7.69,6.07,14.95,13.1,18.91,6.99,4.02,15.82,4.59,23.33,1.71,7.56-2.8,13.65-9,16.37-16.34,2.76-7.35,2.27-15.54-.78-22.24-3.01-6.74-8.44-11.96-14.53-14.72C37.3-.08,30.71-.54,25.04.53c-5.71,1.06-10.53,3.63-14.12,6.6-3.61,2.99-6.04,6.35-7.61,9.28C.21,22.38.12,26.36,0,26.3Z"
        />
        {/* Texto BIOREM - Negro */}
        <Path
          fill="#000000"
          d="M67.87,45.85V15.04h11.86c4.48,0,7.06,3.16,7.06,7.64,0,3.24-1.4,6.55-3.71,7.25,3.78.47,5.77,3.67,5.77,7.92,0,4.91-2.54,8-7.68,8h-13.3ZM79.92,16.09h-10.88v13.53h12.21c2.07,0,4.33-2.54,4.33-6.9,0-3.86-2.18-6.63-5.66-6.63ZM81.64,30.64h-12.6v14.12h12.52c3.71,0,6.08-2.34,6.08-6.86,0-4.17-2.18-7.25-6.01-7.25Z"
        />
        <Path fill="#000000" d="M92.79,45.85V15.04h1.21v30.81h-1.21Z" />
        <Path
          fill="#000000"
          d="M121.73,30.4c0,11.27-4.02,15.8-12.01,15.8s-11.93-4.84-11.93-15.8,3.82-15.68,11.97-15.68,11.97,4.99,11.97,15.68ZM120.52,30.4c0-9.83-2.96-14.51-10.76-14.51s-10.76,4.45-10.76,14.59,3.51,14.59,10.8,14.59,10.73-4.56,10.73-14.66Z"
        />
        <Path
          fill="#000000"
          d="M139.59,30.52l7.18,15.33h-1.44l-7.02-15.13h-11.66v15.13h-1.17V15.04h11.74c5.58,0,7.22,3.12,7.22,7.88,0,4.17-1.64,7.02-4.84,7.61ZM136.9,16.09h-10.26v13.57h11c4.56,0,5.58-2.81,5.58-6.79,0-5.42-2.5-6.79-6.32-6.79Z"
        />
        <Path
          fill="#000000"
          d="M149.92,45.85V15.04h17.98v1.05h-16.81v13.57h16.11v1.01h-16.11v14.12h16.97v1.05h-18.14Z"
        />
        <Path
          fill="#000000"
          d="M196.64,45.85v-28.21c0-.34-.48-.43-.59-.1l-10.21,28.12c-.04.12-.16.2-.29.2h-1.28c-.13,0-.25-.08-.29-.2l-9.98-28.08c-.12-.32-.59-.24-.59.1v28.18h-1.17V15.34c0-.17.14-.31.31-.31h1.47c.13,0,.24.08.29.2l10.37,28.99c.1.27.48.27.58,0l10.52-28.99c.04-.12.16-.2.29-.2h1.47c.17,0,.31.14.31.31v30.5h-1.17Z"
        />
      </G>
    </Svg>
  )
}

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    borderBottom: "2px solid #93d500",
    paddingBottom: 15,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#121C26",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
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
          <View style={styles.headerLeft}>
            <BioremLogo width={140} />
            <Text style={styles.title}>Reporte de Compliance</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.subtitle}>
              {clientName ? clientName : "Todos los clientes"}
            </Text>
            <Text style={styles.subtitle}>Periodo: {periodLabel}</Text>
            <Text style={styles.subtitle}>{generatedAt}</Text>
          </View>
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
