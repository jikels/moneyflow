let network;
let currentNodes = [];
let selectedElement = null;
let selectedIcon = null;
let iconsLoaded = false;

function initializeGraph(data) {
    // Set initial edge values for proportional edges
    data.edges.forEach(edge => {
        edge.value = parseFloat(edge['Amount in Euro']) || 1; // Ensure it's a number
    });

    const container = document.getElementById('graph');
    const options = getGraphOptions();
    network = new vis.Network(container, data, options);

    network.on("stabilized", function () {
        saveNodePositions();
    });

    network.on("select", function (params) {
        if (params.nodes.length > 0) {
            selectedElement = { type: 'node', id: params.nodes[0] };
        } else if (params.edges.length > 0) {
            selectedElement = { type: 'edge', id: params.edges[0] };
        } else {
            selectedElement = null;
        }
        console.log("Selected element:", selectedElement);
    });

    document.querySelectorAll('.color-tile').forEach(tile => {
        tile.addEventListener('click', function() {
            applyColor(this.dataset.color);
        });
    });
}

function getGraphOptions() {
    const physicsEnabled = document.getElementById('enable_physics').value === 'true';

    // Base options
    const options = {
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
            arrows: {
                to: { enabled: true, scaleFactor: 1, type: 'arrow' }
            },
            scaling: {
                min: 1,
                max: 15,
                label: {
                    enabled: true,
                    min: 14,
                    max: 30,
                    maxVisible: 30,
                    drawThreshold: 5
                },
                customScalingFunction: function (min, max, total, value) {
                    if (max === min) {
                        return 0.5;
                    } else {
                        const scale = 1 / (max - min);
                        return Math.max(0, (value - min) * scale);
                    }
                }
            }
        },
        physics: {
            enabled: physicsEnabled
        }
    };

    return options;
}

function saveNodePositions() {
    if (network) {
        currentNodes = network.getPositions();
    }
}

function exportAsPNG() {
    if (network) {
        const canvas = network.canvas.frame.canvas;
        const dataURL = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = "graph_export.png";
        link.click();
    } else {
        alert("No graph data to export. Please generate a graph first.");
    }
}

function applyColor(color) {
    console.log("Applying color:", color);
    if (selectedElement && network) {
        if (selectedElement.type === 'node') {
            network.body.data.nodes.update({id: selectedElement.id, color: color});
        } else if (selectedElement.type === 'edge') {
            network.body.data.edges.update({id: selectedElement.id, color: {color: color}});
        }
        console.log("Color applied to:", selectedElement);
    } else {
        alert("Please select a node or edge first.");
    }
}

function loadIcons() {
    if (iconsLoaded) {
        console.log("Icons already loaded, skipping...");
        return;
    }

    fetch('/get_icons')
        .then(response => response.json())
        .then(data => {
            const iconSelection = document.getElementById('iconSelection');
            iconSelection.innerHTML = ''; // Clear existing icons
            data.icons.forEach(icon => {
                const img = document.createElement('img');
                img.src = icon.url;
                img.alt = icon.name;
                img.title = icon.name;
                img.classList.add('icon-thumbnail');
                img.dataset.icon = icon.url;

                img.addEventListener('click', function() {
                    document.querySelectorAll('.icon-thumbnail').forEach(el => el.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedIcon = this.dataset.icon;
                    applyIconToSelectedNode();
                });

                iconSelection.appendChild(img);
            });
            iconsLoaded = true;
            console.log("Icons loaded successfully");
        })
        .catch(error => {
            console.error("Error loading icons:", error);
        });
}

function applyIconToSelectedNode() {
    if (selectedElement && selectedElement.type === 'node' && selectedIcon) {
        network.body.data.nodes.update({
            id: selectedElement.id,
            shape: 'image',
            image: selectedIcon,
            brokenImage: false
        });
        console.log(`Applied icon ${selectedIcon} to node ${selectedElement.id}`);
    } else {
        alert("Please select a node and an icon first.");
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof initialGraphData !== 'undefined') {
        initializeGraph(initialGraphData);
    } else {
        console.error("initialGraphData is not defined");
    }
    loadIcons(); // This will now only load icons if they haven't been loaded before
    setupDragAndDrop(); // Set up drag and drop functionality

    document.getElementById('enable_physics').addEventListener('change', function() {
        saveNodePositions();
        network.setOptions({ physics: { enabled: this.value === 'true' } });
    });
});

window.addEventListener('load', function() {
    if (typeof initialGraphData !== 'undefined') {
        initializeGraph(initialGraphData);
    }
    // Do not call loadIcons() here
});

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('dragover');
    }

    function unhighlight(e) {
        dropZone.classList.remove('dragover');
    }

    dropZone.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    handleFiles(files);
}

function handleFiles(files) {
    ([...files]).forEach(uploadFile);
}

function uploadFile(file) {
    if (file.type !== 'image/png') {
        alert('Only .png files are allowed');
        return;
    }

    const formData = new FormData();
    formData.append('icon', file);

    fetch('/upload_icon', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            addIconToSelection(data.icon);
        } else {
            alert('Error uploading icon: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error uploading icon: ' + error.message);
    });
}

function addIconToSelection(icon) {
    const iconSelection = document.getElementById('iconSelection');
    const img = document.createElement('img');
    img.src = icon.url;
    img.alt = icon.name;
    img.title = icon.name;
    img.classList.add('icon-thumbnail');
    img.dataset.icon = icon.url;

    img.addEventListener('click', function() {
        document.querySelectorAll('.icon-thumbnail').forEach(el => el.classList.remove('selected'));
        this.classList.add('selected');
        selectedIcon = this.dataset.icon;
        applyIconToSelectedNode();
    });

    iconSelection.appendChild(img);
}