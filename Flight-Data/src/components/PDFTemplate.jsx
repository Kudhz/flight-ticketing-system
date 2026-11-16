import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
  },
  header: {
    marginBottom: 20,
    textAlign: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  table: {
    display: "table",
    width: "auto",
    marginTop: 10,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeader: {
    backgroundColor: "#f0f0f0",
  },
  tableCell: {
    padding: 5,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#000",
  },
  dateCellHeader: {
    width: "20%",
  },
  flightCellHeader: {
    width: "50%",
  },
  passengersCellHeader: {
    width: "30%",
  },
  dateCell: {
    width: "20%",
  },
  flightCell: {
    width: "50%",
  },
  passengersCell: {
    width: "30%",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
  },
});

const PDFTemplate = ({ month, year, flights }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>TAGIHAN FEE TIKET SUSI AIR MELONGUANE</Text>
        <Text style={styles.subtitle}>
          PERIODE BULAN {month.toUpperCase()} {year}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={[styles.tableCell, styles.dateCellHeader]}>
            <Text>Tanggal</Text>
          </View>
          <View style={[styles.tableCell, styles.flightCellHeader]}>
            <Text>Nomor Penerbangan</Text>
          </View>
          <View style={[styles.tableCell, styles.passengersCellHeader]}>
            <Text>Jumlah Penumpang</Text>
          </View>
        </View>

        {flights.map((flight, index) => (
          <View key={index} style={styles.tableRow}>
            <View style={[styles.tableCell, styles.dateCell]}>
              <Text>{new Date(flight.date).toLocaleDateString("id-ID")}</Text>
            </View>
            <View style={[styles.tableCell, styles.flightCell]}>
              <Text>{flight.flightNumber}</Text>
            </View>
            <View style={[styles.tableCell, styles.passengersCell]}>
              <Text>{flight.passengers}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text>
          Total Penumpang:{" "}
          {flights.reduce((sum, flight) => sum + Number(flight.passengers), 0)}
        </Text>
      </View>
    </Page>
  </Document>
);

export default PDFTemplate;
