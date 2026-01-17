"""Utilidades de geolocalización para Photo Guard."""
import math
from typing import Tuple, Optional


def haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calcula la distancia en metros entre dos puntos geográficos
    usando la fórmula de Haversine.

    Args:
        lat1, lon1: Coordenadas del primer punto
        lat2, lon2: Coordenadas del segundo punto

    Returns:
        Distancia en metros
    """
    # Radio de la Tierra en metros
    R = 6371000

    # Convertir a radianes
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    # Fórmula de Haversine
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def is_within_radius(
    user_lat: float,
    user_lon: float,
    target_lat: float,
    target_lon: float,
    radius_meters: float = 500
) -> Tuple[bool, float]:
    """
    Verifica si un punto está dentro de un radio específico.

    Args:
        user_lat, user_lon: Coordenadas del usuario
        target_lat, target_lon: Coordenadas objetivo
        radius_meters: Radio de tolerancia en metros

    Returns:
        Tuple de (está_dentro, distancia_en_metros)
    """
    distance = haversine_distance(user_lat, user_lon, target_lat, target_lon)
    return distance <= radius_meters, distance


def calculate_location_score(distance_meters: Optional[float]) -> Tuple[int, bool]:
    """
    Calcula el score de ubicación basado en la distancia.

    Args:
        distance_meters: Distancia en metros (None si no hay ubicación)

    Returns:
        Tuple de (score, location_verified)
    """
    if distance_meters is None:
        return 0, False

    if distance_meters <= 100:
        return 40, True  # Muy cerca
    elif distance_meters <= 300:
        return 30, True  # Cerca
    elif distance_meters <= 500:
        return 20, True  # Aceptable
    else:
        return 0, False  # Muy lejos
