/*
 * Copyright 2024 Joel Ikels
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


// Global Script

let network;
let currentNodes = [];
let filteredData;

function initializeGraph(data) {
    const container = document.getElementById('graph');
    const options = getGraphOptions();
    network = new vis.Network(container, {nodes: [], edges: []}, options);

    // Load initial subset of data
    loadDataSubset(data, 0, 100);

    network.on("stabilized", function () {
        // Load more data when graph is stable
        loadDataSubset(data, network.body.data.nodes.length, 100);
    });
}

function loadDataSubset(data, start, count) {
    const subset = {
        nodes: data.nodes.slice(start, start + count),
        edges: data.edges.slice(start, start + count)
    };
    network.body.data.nodes.add(subset.nodes);
    network.body.data.edges.add(subset.edges);
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
        filteredData = data.filtered_data;  // Store the filtered data
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
            Largest Edge Sum: €${formatCurrency(stats.largest_transaction)} |
            Highest Volume Sender: ${stats.most_frequent_sender} |
            Highest Volume Recipient: ${stats.most_frequent_recipient} |
            Total Volume: €${formatCurrency(totalSentAmount)}
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
    const formData = new FormData();
    
    // Add selected labels
    formData.append('from_label', document.getElementById('fromLabelSelect').value);
    formData.append('to_label', document.getElementById('toLabelSelect').value);
    
    // Add all current filter values
    ['from_account', 'to_account', 'from_sender', 'to_recipient', 
     'min_amount', 'max_amount', 'from_date', 'to_date'].forEach(id => {
        formData.append(id, document.getElementById(id).value);
    });

    fetch('/get_transaction_history', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        updateTransactionTable(data.transactions);
    })
    .catch(error => console.error("Error fetching transaction history:", error));
}

function annotateGraph() {
    console.log("annotateGraph function called");
    
    // Include the filtered data in the request
    const dataToSend = {
        graph_state: network.body.data,
        filtered_data: filteredData
    };

    fetch('/save_graph_state', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const annotationUrl = `/annotate?csv_file=${data.csv_file}`;
            window.open(annotationUrl, '_blank');
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

function formatCurrency(value) {
    return parseFloat(value).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function openTransactionTable(fromLabel, toLabel) {
    // Get all current filter values
    const params = new URLSearchParams({
        from: fromLabel,
        to: toLabel,
        from_account: document.getElementById('from_account').value,
        to_account: document.getElementById('to_account').value,
        from_sender: document.getElementById('from_sender').value,
        to_recipient: document.getElementById('to_recipient').value,
        min_amount: document.getElementById('min_amount').value,
        max_amount: document.getElementById('max_amount').value,
        from_date: document.getElementById('from_date').value,
        to_date: document.getElementById('to_date').value,
        use_filters: 'true'  // Add this flag
    });

    const url = `/transaction_table?${params.toString()}`;
    console.log("Opening transaction table with URL:", url);
    window.open(url, '_blank');
}
