// Global Script

let network;
let currentNodes = [];

function initializeGraph(data) {
    const container = document.getElementById('graph');
    const options = getGraphOptions();
    network = new vis.Network(container, data, options);

    // Save node positions when stabilized
    network.on("stabilized", function () {
        saveNodePositions();
    });
}

function getGraphOptions() {
    const proportionalEdges = document.getElementById('proportional_edges') ? 
        document.getElementById('proportional_edges').value === 'true' : true;
    return {
        nodes: {
            shape: 'dot',
            size: 30,
            font: {
                size: 12,
                color: '#000000'
            },
            borderWidth: 2,
            fixed: {
                x: false,
                y: false
            }
        },
        edges: {
            width: proportionalEdges ? undefined : 2,
            scaling: {
                min: 1,
                max: 10,
                label: {
                    enabled: false
                }
            },
            arrows: {
                to: { enabled: true, scaleFactor: 1, type: 'arrow' }
            }
        },
        physics: {
            enabled: document.getElementById('enable_physics') ? 
                document.getElementById('enable_physics').value === 'true' : true
        }
    };
}

function saveNodePositions() {
    if (network) {
        currentNodes = network.getPositions();
    }
}

function updateGraph() {
    console.log("Updating graph...");

    const formData = new FormData();
    ['from_account', 'to_account', 'from_sender', 'to_recipient', 'min_amount', 'max_amount', 'from_date', 'to_date', 'display_amounts', 'enable_physics', 'proportional_edges'].forEach(id => {
        formData.append(id, document.getElementById(id).value);
    });

    fetch('/get_graph_data', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log("Received data from server:", data);
        const container = document.getElementById('graph');

        if (data.graph_data.nodes.length === 0 && data.graph_data.edges.length === 0) {
            console.log("No data to display");
            container.innerHTML = "<p>No data to display. Try adjusting your filters.</p>";
        } else {
            if (network) {
                network.destroy();
            }
            const options = getGraphOptions();
            
            // Apply saved positions to nodes
            data.graph_data.nodes.forEach(node => {
                if (currentNodes[node.id]) {
                    node.x = currentNodes[node.id].x;
                    node.y = currentNodes[node.id].y;
                }
            });

            network = new vis.Network(container, data.graph_data, options);
            console.log("Updating label selects and filtering transactions");
            updateLabelSelects(data.graph_data.nodes);
            filterTransactions(); // Add this line to update the transaction table

            // Save node positions when stabilized
            network.on("stabilized", function () {
                saveNodePositions();
            });
        }

        // Update Summary Statistics as Watermark
        updateSummaryWatermark(data.summary_stats);
    })
    .catch(error => {
        console.error("Error updating graph:", error);
    });
}

function updateSummaryWatermark(stats) {
    const watermark = document.getElementById('summaryWatermark');
    if (watermark) {
        const totalSentAmount = Object.values(stats.total_sent).reduce((a, b) => a + b, 0);
        const totalReceivedAmount = Object.values(stats.total_received).reduce((a, b) => a + b, 0);

        watermark.innerHTML = `
            Total Transactions: ${stats.total_transactions} |
            Largest Transaction: €${stats.largest_transaction.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} |
            Most Frequent Sender: ${stats.most_frequent_sender} |
            Most Frequent Recipient: ${stats.most_frequent_recipient} |
            Total Sent: €${totalSentAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} |
            Total Received: €${totalReceivedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        `;
    }
}

function updateLabelSelects(nodes) {
    const fromSelect = document.getElementById('fromLabelSelect');
    const toSelect = document.getElementById('toLabelSelect');
    
    // Store current selections
    const fromValue = fromSelect.value;
    const toValue = toSelect.value;
    
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    nodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = node.id;
        fromSelect.appendChild(option.cloneNode(true));
        toSelect.appendChild(option);
    });

    // Restore selections if they still exist in the new options
    if (fromValue && fromSelect.querySelector(`option[value="${fromValue}"]`)) {
        fromSelect.value = fromValue;
    }
    if (toValue && toSelect.querySelector(`option[value="${toValue}"]`)) {
        toSelect.value = toValue;
    }

    // Trigger filterTransactions when selections change
    fromSelect.addEventListener('change', filterTransactions);
    toSelect.addEventListener('change', filterTransactions);

    // Initial filter
    filterTransactions();
}

function filterTransactions() {
    console.log("Filtering transactions...");

    const fromLabel = document.getElementById('fromLabelSelect').value;
    const toLabel = document.getElementById('toLabelSelect').value;
    
    console.log(`Filtering transactions from "${fromLabel}" to "${toLabel}"`);

    const formData = new FormData();
    formData.append('from_label', fromLabel);
    formData.append('to_label', toLabel);

    fetch('/get_filtered_transactions', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log("Received filtered transactions from server:", data);
        const tableBody = document.querySelector('#transactionTable tbody');
        tableBody.innerHTML = '';
        if (data.transactions.length === 0) {
            console.log("No transactions found");
            tableBody.innerHTML = '<tr><td colspan="4">No transactions found</td></tr>';
        } else {
            data.transactions.forEach(transaction => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = transaction.Date;
                row.insertCell().textContent = transaction['From Label'];
                row.insertCell().textContent = transaction['To Label'];
                row.insertCell().textContent = parseFloat(transaction['Amount in Euro']).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            });
        }
        // Show the transaction table container
        const tableContainer = document.getElementById('transactionTableContainer');
        if (tableContainer) {
            tableContainer.style.display = 'block';
        } else {
            console.error("Transaction table container not found");
        }
    })
    .catch(error => {
        console.error("Error fetching filtered transactions:", error);
    });
}

function annotateGraph() {
    console.log("annotateGraph function called");
    // Save the current graph state
    const graphState = JSON.stringify(network.body.data);

    console.log("Graph state to be sent for annotation:", graphState);

    // Send the graph state to the server to save as CSV
    fetch('/save_graph_state', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: graphState
    })
    .then(response => {
        console.log("Response received from server:", response);
        return response.json();
    })
    .then(data => {
        console.log("Data received from server:", data);
        if (data.success) {
            console.log("Opening annotation page with URL:", `/annotate?csv_file=${data.csv_file}`);
            const annotationUrl = `/annotate?csv_file=${data.csv_file}`;
            const newWindow = window.open(annotationUrl, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
                console.error("Popup blocked or failed to open");
                alert("The annotation page couldn't be opened. Please check your popup blocker settings and try again.");
            }
        } else {
            console.error("Error saving graph state:", data.error);
            alert("Error saving graph state. Please try again.");
        }
    })
    .catch(error => {
        console.error("Error in fetch operation:", error);
        alert("An error occurred while trying to annotate the graph. Please try again.");
    });
}

function saveGraphState() {
    if (network) {
        const graphState = {
            nodes: network.body.data.nodes,
            edges: network.body.data.edges
        };

        fetch('/save_graph_state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(graphState)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
            } else {
                console.error("Error saving graph state:", data.error);
                alert("Error saving graph state. Please try again.");
            }
        })
        .catch(error => {
            console.error("Error saving graph state:", error);
            alert("Error saving graph state. Please try again.");
        });
    } else {
        alert("No graph data to save. Please generate a graph first.");
    }
}

// Initialize graph with all data
window.addEventListener('load', function() {
    console.log("Window loaded");
    console.log("Initial graph data:", initialGraphData);
    initializeGraph(initialGraphData);
    updateGraph(); // To populate the watermark with initial data

    // Initialize collapsible menus
    const coll = document.getElementsByClassName("collapsible-button");
    Array.from(coll).forEach((button, index) => {
        button.addEventListener("click", function() {
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            if (content && content.style) {
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            }
            
            // Toggle transaction table for the Transaction Details button
            if (this.id === 'transactionDetailsButton') {
                toggleTransactionTable();
                console.log("Transaction details button clicked");
            }
        });
    });

    console.log("Collapsible buttons:", coll);
});

function toggleTransactionTable() {
    const tableContainer = document.getElementById('transactionTableContainer');
    const transactionDetailsButton = document.getElementById('transactionDetailsButton');
    
    if (tableContainer && transactionDetailsButton) {
        tableContainer.classList.toggle('active');
        if (tableContainer.classList.contains('active')) {
            transactionDetailsButton.textContent = '📄 Transaction Details';
            filterTransactions(); // Update the table content
        } else {
            transactionDetailsButton.textContent = '📄 Transaction Details';
        }
    } else {
        console.error("Transaction table container or button not found");
    }
}
// Set up event listeners for controls
document.querySelectorAll('select, input').forEach(element => {
    element.addEventListener('change', function() {
        if (this.id === 'enable_physics') {
            saveNodePositions();
        }
        // Remove the updateGraph() call here
    });
});

// Add this to ensure the graph updates when filters change
function applyFilters() {
    updateGraph();
}

// Attach the applyFilters function to all filter inputs
document.querySelectorAll('#from_account, #to_account, #from_sender, #to_recipient, #min_amount, #max_amount, #from_date, #to_date, #display_amounts, #enable_physics, #proportional_edges').forEach(element => {
    element.addEventListener('change', applyFilters);
});

function viewTransactionTable(useFilters = false) {
    let url = '/transaction_table?';
    if (useFilters) {
        const filters = {
            from_account: document.getElementById('from_account').value,
            to_account: document.getElementById('to_account').value,
            from_sender: document.getElementById('from_sender').value,
            to_recipient: document.getElementById('to_recipient').value,
            min_amount: document.getElementById('min_amount').value,
            max_amount: document.getElementById('max_amount').value,
            from_date: document.getElementById('from_date').value,
            to_date: document.getElementById('to_date').value
        };
        
        console.log("Filters being applied:", filters);
        
        const queryString = Object.entries(filters)
            .filter(([_, value]) => value !== '')
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        
        url += `${queryString}&use_filters=true`;
    } else {
        const fromLabel = document.getElementById('fromLabelSelect').value;
        const toLabel = document.getElementById('toLabelSelect').value;
        url += `from=${encodeURIComponent(fromLabel)}&to=${encodeURIComponent(toLabel)}`;
    }
    console.log("Transaction table URL:", url);
    window.open(url, '_blank');
}